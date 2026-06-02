export const environment = {
  production: false,

  // ── Para usar desde el celular con ngrok ──────────────────────────────────
  // 1. Correr el backend con: ng serve --host 0.0.0.0  (o el comando del back)
  // 2. Abrir un túnel ngrok al puerto del BACKEND: ngrok http 8080
  // 3. Reemplazar la URL de abajo con la URL https que te da ngrok
  // 4. Para que el front sea accesible desde el celu: ngrok http 4200
  //    y en angular.json > serve > options agregar: "allowedHosts": ["all"]
  // apiBaseUrl: 'https://XXXX-XX-XX-XX-XX.ngrok-free.app/api',  ← ngrok del back

  apiBaseUrl: 'http://localhost:8080/api',  // ← uso local normal
  googleClientId: '605350584310-kiivqgb65fisp5visrh53451gi9ndgj1.apps.googleusercontent.com',
  devHogarId:   '00000000-0000-0000-0000-000000000001',
  devUsuarioId: '00000000-0000-0000-0000-000000000001',
  offWorldBase: 'https://world.openfoodfacts.org',
  offArBase:    'https://ar.openfoodfacts.org',
  upcItemDb:    'https://api.upcitemdb.com',
};
