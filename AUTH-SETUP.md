# Authentication setup for Copper

Copper no longer ships another launcher's OAuth application IDs. Without your own registrations, Microsoft/Ely.by sign-in and refresh return a clear configuration error before contacting the OAuth service. Local instance management and the local skin library still work.

## Microsoft

1. Use your own Microsoft/Azure account with an Entra tenant and permission to register applications. Follow Microsoft's prerequisites; an ordinary Minecraft account alone does not necessarily provide an Entra directory.
2. In the [Microsoft Entra admin center](https://entra.microsoft.com), open **Entra ID → App registrations → New registration**.
3. Name the application **Copper Launcher**. Select an account audience that supports personal Microsoft accounts; Copper currently uses the `/consumers` endpoint.
4. Enable the public-client/device-code flow for the application. The launcher requests `XboxLive.signin offline_access` and does not embed a client secret.
5. Copy **Application (client) ID** from Overview. Configure the build as shown below.
6. Confirm that this registration is permitted to access Xbox/Minecraft services, then test a real purchased Java account. Registering an Entra application does not itself guarantee Minecraft API access. Resolve access restrictions with the provider instead of borrowing another launcher's ID.

Official references: [app registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app), [device authorization protocol](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code).

## Ely.by

Use the [Ely.by developer portal](https://account.ely.by/dev) to register Copper as a launcher/public desktop application supported by the device-code flow. The current implementation uses `account_info minecraft_server_session` and does not distribute a client secret.

The [published general OAuth guide](https://docs.ely.by/en/oauth.html) describes a website authorization-code flow with a secret. That flow is different from Copper's device-code flow. If the registration UI only offers a website client, confirm desktop/device-code support with Ely.by before using it. Do not put a website client secret in the launcher.

## Build with your public IDs

From the `copper-launcher` folder, in PowerShell:

```powershell
$env:COPPER_MS_CLIENT_ID = 'YOUR_OWN_MICROSOFT_APPLICATION_ID'
$env:COPPER_ELY_CLIENT_ID = 'YOUR_OWN_ELY_APPLICATION_ID'
powershell -NoProfile -ExecutionPolicy Bypass -File ..\copper-installer\build.ps1
```

Replace the placeholders only with registrations you own or are explicitly authorized to use. Omit either variable to leave that provider unconfigured. These IDs are compiled into the launcher. Existing sessions created with an old application may need a fresh sign-in after migration.

Discord Rich Presence is optional. It has no default application registration; supply your own `COPPER_DISCORD_APP_ID` in the runtime environment if you enable it.

## Пока регистраций нет

Можно собрать Copper без этих переменных. Локальные инстансы и предпросмотр скинов доступны, но новый вход Microsoft/Ely.by не настроен. Это не разрешает играть без приобретённой лицензии Minecraft.

Начни с Microsoft Entra: открой портал своим аккаунтом и проверь, есть ли раздел App registrations. Если портал требует создать каталог/подписку или не даёт доступ, сначала нужно решить этот вопрос; подставлять чужой ID вместо регистрации не нужно.
