import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GitHubStrategy } from 'passport-github2';
import authService from '../services/authService.js';

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        const user = await authService.findUserByEmail(email);
        
        if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
        }

        const isValid = await authService.validatePassword(password, user.password);
        
        if (!isValid) {
            return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://pairgodszealxmd.onrender.com/auth/github/callback',
        scope: ['user:email', 'repo', 'user:follow']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await authService.findUserByGithubId(profile.id);
            
            if (!user) {
                const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.username}@github.com`;
                user = await authService.createUser(
                    profile.username,
                    email,
                    null,
                    profile.id,
                    accessToken
                );
            } else {
                await authService.updateGithubToken(user.id, accessToken);
            }

            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }));
}

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await authService.findUserById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

export default passport;
