/**
 * MSAL Configuration
 * Microsoft Authentication Library configuration for Azure AD SSO
 */
import { LogLevel } from '@azure/msal-browser';

// MSAL configuration - will be dynamically configured based on backend settings
export const getMsalConfig = (clientId, tenantId) => ({
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: `${window.location.origin}/login`,
    postLogoutRedirectUri: `${window.location.origin}/login`,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
          case LogLevel.Info:
            console.info(message);
            break;
          case LogLevel.Verbose:
            console.debug(message);
            break;
          default:
            break;
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
});

// Login request configuration
export const loginRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    'User.Read',
    'Mail.Read',
    'Mail.Send',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'offline_access'
  ],
};

// Silent token request for API calls
export const tokenRequest = {
  scopes: ['User.Read', 'Mail.Read', 'Calendars.Read'],
};
