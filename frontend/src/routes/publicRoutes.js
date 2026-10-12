import {
  LandingPage,
  LoginPage,
  SignupPage,
  VerifyEmailPage,
  PasswordResetPage,
  RequestInstitutionPage,
  LandingLab,
} from './pages';

export const publicRoutes = [
  { path: '/', Page: LandingPage },
  { path: '/landing-lab', Page: LandingLab },
  { path: '/login', Page: LoginPage },
  { path: '/signup', Page: SignupPage },
  { path: '/verify-email', Page: VerifyEmailPage },
  { path: '/password-reset', Page: PasswordResetPage },
  { path: '/request-institution', Page: RequestInstitutionPage },
];
