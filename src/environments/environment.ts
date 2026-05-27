export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080',
  // Temporary placeholders used until auth (JWT) is implemented.
  // Once login exists, hogarId and usuarioId will come from the JWT claims
  // and these values will be replaced by the auth interceptor.
  devHogarId:   '00000000-0000-0000-0000-000000000001',
  devUsuarioId: '00000000-0000-0000-0000-000000000001',
};
