import { Octokit } from '@octokit/rest';
import prisma from '../config/database.js';

class GitHubService {
    constructor() {
        this.devUsername = process.env.DEV_GITHUB_USERNAME || 'mruniquehacker';
        this.botRepoOwner = process.env.BOT_REPO_OWNER;
        this.botRepoName = process.env.BOT_REPO_NAME;
    }

    getOctokit(token) {
        return new Octokit({ auth: token });
    }

    async validateToken(token) {
        try {
            const octokit = this.getOctokit(token);
            const { data } = await octokit.users.getAuthenticated();
            return { valid: true, user: data };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    async followDevAccount(token) {
        try {
            const octokit = this.getOctokit(token);
            await octokit.users.follow({ username: this.devUsername });
            return { success: true };
        } catch (error) {
            console.error('Error following dev account:', error);
            return { success: false, error: error.message };
        }
    }

    async forkRepository(token) {
        try {
            const octokit = this.getOctokit(token);
            const { data } = await octokit.repos.createFork({
                owner: this.botRepoOwner,
                repo: this.botRepoName
            });
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            return { success: true, repo: data };
        } catch (error) {
            console.error('Error forking repository:', error);
            return { success: false, error: error.message };
        }
    }

    async starRepository(token, owner, repo) {
        try {
            const octokit = this.getOctokit(token);
            await octokit.activity.starRepoForAuthenticatedUser({
                owner,
                repo
            });
            return { success: true };
        } catch (error) {
            console.error('Error starring repository:', error);
            return { success: false, error: error.message };
        }
    }

    async createOrUpdateFile(token, owner, repo, path, content, message) {
        try {
            const octokit = this.getOctokit(token);
            
            let sha;
            try {
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path
                });
                sha = data.sha;
            } catch (error) {
            }

            const { data } = await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path,
                message,
                content: Buffer.from(content).toString('base64'),
                sha
            });

            return { success: true, data };
        } catch (error) {
            console.error('Error creating/updating file:', error);
            return { success: false, error: error.message };
        }
    }

    async pushCredsToRepo(token, username, credsContent) {
        const path = `sessions/creds_${Date.now()}.json`;
        const message = 'Add session credentials';
        
        return await this.createOrUpdateFile(
            token,
            username,
            this.botRepoName,
            path,
            credsContent,
            message
        );
    }

    async createWorkflow(token, username) {
        const workflowContent = `name: Node.js CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x]

    steps:
    - name: Checkout repository
      uses: actions/checkout@v3

    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: \${{ matrix.node-version }}

    - name: Install dependencies
      run: npm install

    - name: Start application
      run: npm start
`;

        const path = '.github/workflows/ci.yml';
        const message = 'Add CI workflow';

        return await this.createOrUpdateFile(
            token,
            username,
            this.botRepoName,
            path,
            workflowContent,
            message
        );
    }

    async automateGitHubSetup(userId, credsContent) {
        try {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            
            if (!user || !user.githubToken) {
                throw new Error('User or GitHub token not found');
            }

            const token = user.githubToken;
            const validation = await this.validateToken(token);
            
            if (!validation.valid) {
                throw new Error('Invalid GitHub token');
            }

            const githubUsername = validation.user.login;

            await this.followDevAccount(token);
            
            const forkResult = await this.forkRepository(token);
            if (!forkResult.success) {
                throw new Error(`Fork failed: ${forkResult.error}`);
            }

            await this.starRepository(token, this.botRepoOwner, this.botRepoName);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.pushCredsToRepo(token, githubUsername, credsContent);
            
            await this.createWorkflow(token, githubUsername);

            return {
                success: true,
                repoUrl: `https://github.com/${githubUsername}/${this.botRepoName}`,
                repoName: this.botRepoName
            };
        } catch (error) {
            console.error('GitHub automation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default new GitHubService();
