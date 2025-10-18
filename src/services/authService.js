import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';

class AuthService {
    async createUser(username, email, password, githubId = null, githubToken = null) {
        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
        
        const user = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                githubId,
                githubToken
            }
        });

        delete user.password;
        return user;
    }

    async findUserByEmail(email) {
        return await prisma.user.findUnique({
            where: { email }
        });
    }

    async findUserById(id) {
        return await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                githubId: true,
                createdAt: true
            }
        });
    }

    async findUserByGithubId(githubId) {
        return await prisma.user.findUnique({
            where: { githubId }
        });
    }

    async validatePassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    async updateGithubToken(userId, githubToken) {
        return await prisma.user.update({
            where: { id: userId },
            data: { githubToken }
        });
    }

    generateJWT(user) {
        return jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'default_jwt_secret',
            { expiresIn: '7d' }
        );
    }
}

export default new AuthService();
