// Real Gmail responses, reduced to what the server reads.
export const SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const SEND = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export const token = {
  access_token: "ya29.gmail-1",
  expires_in: 3599,
  refresh_token: "1//gmail-refresh-1",
  scope: `openid https://www.googleapis.com/auth/userinfo.email ${SEND_SCOPE}`,
  token_type: "Bearer",
  id_token: "eyJhbGciOiJSUzI1NiJ9.e30.sig",
};

export const sent = { id: "19a1b2c3d4e5f6a7", threadId: "19a1b2c3d4e5f6a7", labelIds: ["SENT"] };

export const unauthorized = {
  error: {
    code: 401,
    message: "Request had invalid authentication credentials.",
    status: "UNAUTHENTICATED",
  },
};
