import { showToast } from '../state/ui'
import { tauri } from './tauri'

export interface Profile {
  name: string
  version: string
  fabric: boolean
  loader?: string | null
  loader_version?: string | null
  icon?: string | null
}

export interface McVersion {
  id: string
  kind: string
}

export interface LoaderBuild {
  version: string
  stable: boolean
  recommended: boolean
}

export interface ModFile {
  name: string
  enabled: boolean
  project_id?: string
  version_number?: string
  title?: string
  icon_url?: string
  author?: string
  description?: string
  mc?: string
  loader?: string
  loaders?: string[]
  size: number
  scanned: boolean
  /** Когда файл появился в сборке, секунды Unix (новое ядро). */
  added?: number
}

export interface ScanResult {
  scanned: number
  identified: number
  // Recognised by hash on Modrinth and by fingerprint on CurseForge
  modrinth: number
  curseforge: number
  items: ModFile[]
}

export interface UpdateInfo {
  file_name: string
  new_version_id: string
  new_version_number: string
}

export interface WorldEntry {
  name: string
  folder: string
  last_played: number
}

export interface WorldInstall {
  folder: string
  mismatch: string
}

export interface ServerEntry {
  name: string
  ip: string
}

export interface FoundInstance {
  name: string
  version: string
  loader: string
  path: string
  source: string
  /** Prism, MultiMC или Modrinth App: сборку можно перенести целиком. */
  movable?: boolean
}

export interface MoveCandidate {
  path: string
  name: string
  version: string
  loader: string
  launcher: string
  bytes: number
  files: number
  worlds: number
  mods: number
}

export interface MoveOutcome {
  profile: Profile
}

export interface JavaInfo {
  path: string
  version: string
}

export interface CfHit {
  id: number
  name: string
  summary: string
  logo: string
  downloads: number
  slug: string
  website: string
}

export interface ProfileSettings {
  jvmArgs?: string
  width?: number
  height?: number
  javaPath?: string
  javaMajor?: number
  gpu?: GpuPref
  ramMb?: number
  autoTune?: boolean
  catalogPackSlug?: string
  catalogPackVersion?: string
  /** sha512 of the published archive the build was installed from; empty for builds installed before it was kept. */
  catalogPackSha512?: string
  /** Non-empty when a review candidate is installed instead of the published version. */
  catalogPackReviewFile?: string
  modpackSlug?: string
}

export type GpuPref = 'auto' | 'discrete' | 'integrated'

export interface ModpackInfo {
  slug: string
  versionId: string
}

export interface ModpackVersion {
  id: string
  name?: string
  version_number?: string
  date?: string
  changelog?: string
  type?: string
}

export interface DeviceStart {
  device_code: string
  user_code: string
  verification_uri?: string
  interval?: number
}

export interface DevicePoll {
  status: string
  nick: string
  uuid?: string
  xuid?: string
  expires_in?: number
}

export interface MsSessionResult {
  status: 'ok' | 'relogin' | 'unavailable' | 'none' | 'expired'
  nick?: string
  uuid?: string
  xuid?: string
  expires_in?: number
}

export interface McTextures {
  uuid: string
  nick: string
  skin: string | null
  cape: string | null
  slim: boolean
}

export type ProfileGroups = Record<string, string>

type CoreFailureReporter = (cmd: string, err: unknown, args?: Record<string, unknown>) => void | Promise<void>

let coreFailureReporter: CoreFailureReporter | null = null

// Registered from lib/crash.ts rather than imported: crash.ts sends its report
// through this very wrapper, and a direct import would close a module cycle.
export const onCoreFailure = (fn: CoreFailureReporter | null) => {
  coreFailureReporter = fn
}

const invoke = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  const T = tauri()
  if (!T) return Promise.reject(new Error('no tauri'))
  return T.core.invoke<T>(cmd, args).catch((err: unknown) => {
    const report = coreFailureReporter
    if (report) void Promise.resolve().then(() => report(cmd, err, args))
    throw err
  })
}

export const convertFileSrc = (path: string): string => {
  const T = tauri()
  return T && T.core.convertFileSrc ? T.core.convertFileSrc(path) : path
}

export interface InstallJob {
  key: string
  title: string
  pct: number
  msg: string
  paused: boolean
  pausable: boolean
}

export const activeInstalls = () => invoke<InstallJob[]>('active_installs', {})

export const cancelInstall = (key: string) => invoke<boolean>('cancel_install', { key })

export const pauseInstall = (key: string, paused: boolean) => invoke<boolean>('pause_install', { key, paused })

export interface StoreGameState {
  slug: string
  steam: boolean
  steamClient: boolean
  store: boolean
  windows: boolean
}

export const storeGamesState = () => invoke<StoreGameState[]>('store_games_state', {})
export const storeGameOpen = (slug: string, via: 'steam' | 'steam-install' | 'store-page' | 'store') =>
  invoke<void>('store_game_open', { slug, via })
export const storeGameInstall = (slug: string) => invoke<void>('store_game_install', { slug })

export const addLocalFile = (profile: string, kind: string, path: string) =>
  invoke<string>('add_local_file', { profile, kind, path })

export const pickContentFiles = (kind: string) => invoke<string[]>('pick_content_files', { kind })

export const addServer = (profile: string, name: string, ip: string) =>
  invoke<ServerEntry[]>('add_server', { profile, name, ip })

export const backupWorld = (profile: string, folder: string) =>
  invoke<string>('backup_world', { profile, folder })

export const listBackups = (profile: string) => invoke<string[]>('list_backups', { profile })

/// Empty `file` with a non-empty `mismatch` means nothing fits the build: the
/// mismatch text lists the versions the project does ship.
export interface ContentInstall {
  file: string
  mismatch: string
  warning: string
}

/// One project the resolver decided about. `problem` is filled only for
/// dependencies nothing compatible was found for.
export interface DepNode {
  source: 'modrinth' | 'curseforge' | 'copper'
  project_id: string
  version_id: string
  title: string
  icon: string
  version_number: string
  file_name: string
  size: number
  relation: string
  required_by: string
  problem: string
}

export interface DepConflict {
  title: string
  file_name: string
  with: string
  reason: string
}

export interface DepPlan {
  title: string
  version_number: string
  mismatch: string
  required: DepNode[]
  optional: DepNode[]
  missing: DepNode[]
  conflicts: DepConflict[]
  truncated: boolean
}

export interface PlanItem {
  source: string
  project_id: string
  version_id?: string
}

export interface DepReport {
  installed: string[]
  failed: string[]
}

export interface AuditIssue {
  kind: 'missing' | 'conflict' | 'version' | 'loader'
  title: string
  detail: string
  file_name: string
  fix: DepNode | null
  dep?: string
}

export interface DepAudit {
  checked: number
  issues: AuditIssue[]
}

export const depPlan = (
  profile: string,
  kind: string,
  source: string,
  project: string,
  versionId?: string,
) => invoke<DepPlan>('dep_plan', { profile, kind, source, project, versionId: versionId || null })

export const installDepItems = (profile: string, kind: string, items: PlanItem[]) =>
  invoke<DepReport>('install_dep_items', { profile, kind, items })

export const auditDeps = (profile: string) => invoke<DepAudit>('audit_deps', { profile })

export const cfInstall = (
  modId: number,
  gameVersion: string,
  profile: string,
  kind: string,
  fileId?: number,
  allowMismatch = false,
) =>
  invoke<ContentInstall>('cf_install', {
    modId,
    gameVersion,
    profile,
    kind,
    fileId: fileId ?? null,
    allowMismatch,
  })

export const cfInstallModpack = (modId: number, fileId?: number) =>
  invoke<Profile>('cf_install_modpack', { modId, fileId: fileId ?? null })

export interface CfImage {
  url: string
  title: string
}

export interface CfProject {
  id: number
  name: string
  summary: string
  logo: string
  downloads: number
  authors: string
  categories: string[]
  game_versions: string[]
  website: string
  updated: string
  description: string
  gallery: CfImage[]
}

export interface CfFileInfo {
  id: number
  name: string
  file_name: string
  game_versions: string[]
  loaders: string[]
  size: number
  date: string
  release: number
  server_pack: boolean
}

export const cfProject = (modId: number) => invoke<CfProject>('cf_project', { modId })

export const cfFiles = (modId: number, gameVersion = '') =>
  invoke<CfFileInfo[]>('cf_files', { modId, gameVersion })

export const cfInstallWorld = (modId: number, profile: string, force = false) =>
  invoke<WorldInstall>('cf_install_world', { modId, profile, force })

export const cfSearch = (
  query: string,
  kind: string,
  gameVersion: string,
  loader: string,
  index = 0,
  category = 0,
  sort = 0,
) => invoke<CfHit[]>('cf_search', { query, kind, gameVersion, loader, index, category, sort })

/** Сырой ответ CurseForge для каталога: поиск (v1/mods/search) и категории (v1/categories). */
export const cfBrowse = (path: string, query: [string, string][]) =>
  invoke<unknown>('cf_browse', { path, query })

export const checkUpdates = (profile: string, kind: string) =>
  invoke<UpdateInfo[]>('check_updates', { profile, kind })

export const countScreenshots = (profile: string) => invoke<number>('count_screenshots', { profile })

export const createProfile = (
  name: string,
  version: string,
  fabric: boolean,
  loader: string,
  icon: string | null,
  loaderVersion: string | null = null,
) => invoke<Profile>('create_profile', { name, version, fabric, loader, loaderVersion, icon })

export const deleteContent = (profile: string, kind: string, name: string) =>
  invoke<void>('delete_content', { profile, kind, name })

export const deleteProfile = (name: string) => invoke<Profile[]>('delete_profile', { name })

export const deleteWorld = (profile: string, folder: string) => invoke<void>('delete_world', { profile, folder })

export const renameProfile = (name: string, newName: string) =>
  invoke<Profile[]>('rename_profile', { name, newName })

export const setProfileLoader = (name: string, version: string, loader: string, loaderVersion: string | null = null) =>
  invoke<Profile[]>('set_profile_loader', { name, version, loader, loaderVersion })

export const detectJava = () => invoke<JavaInfo[]>('detect_java')

export interface JavaRuntime {
  major: number
  size: number
  path: string
  in_use: boolean
}

export const listJavaRuntimes = () => invoke<JavaRuntime[]>('list_java_runtimes')

export const defaultJava = () => invoke<JavaInfo | null>('default_java')

export const setDefaultJava = (path: string | null) => invoke<void>('set_default_java', { path })

export const javaMajors = () => invoke<number[]>('java_majors')

export const downloadJavaRuntime = (major: number) => invoke<string>('download_java_runtime', { major })

export const removeJavaRuntime = (major: number) => invoke<number>('remove_java_runtime', { major })

export interface DiscordStatus {
  connected: boolean
  app_id: string
  last_error: string
  last_activity: string
  /** Discord account the activity is shown on; empty when nothing is shown. */
  userId: string
}

export const discordPresence = (
  details: string,
  state: string,
  playing: boolean,
  largeImage?: string,
  largeText?: string,
) => invoke<DiscordStatus>('discord_presence', { details, state, playing, largeImage, largeText })

export const discordStatus = () => invoke<DiscordStatus>('discord_status')

export const discordReconnect = () => invoke<DiscordStatus>('discord_reconnect')

export const discordClear = () => invoke<void>('discord_clear')

export const duplicateProfile = (name: string) => invoke<Profile[]>('duplicate_profile', { name })

export const exportMrpack = (profile: string, name: string, version: string, description: string) =>
  invoke<string>('export_mrpack', { profile, name, version, description })

export const getPlaytime = (profile: string) => invoke<number>('get_playtime', { profile })

export interface PlayEntry {
  key: string
  label: string
  seconds: number
  last: number
  sessions: number
}

export interface PlayStats {
  total_seconds: number
  sessions: number
  builds: PlayEntry[]
  servers: PlayEntry[]
  last_build: string
  last_server: string
  last_server_name: string
  last_at: number
}

export const getPlayStats = () => invoke<PlayStats>('get_play_stats')

export const labelServer = (addr: string, name: string) => invoke<void>('label_server', { addr, name })

export const getProfileGroups = () => invoke<ProfileGroups>('get_profile_groups')

export const importInstance = (path: string, name: string, version: string, loader: string) =>
  invoke<Profile>('import_instance', { path, name, version, loader })

export const importPackFile = (path?: string) => invoke<Profile>('import_pack_file', { path: path || null })

export const importDroppedPack = (id: number) => invoke<Profile>('import_dropped_pack', { id })

export const installContent = (
  project: string,
  gameVersion: string,
  profile: string,
  kind: string,
  allowMismatch = false,
) => invoke<ContentInstall>('install_content', { project, gameVersion, profile, kind, allowMismatch })

export const installMod = (project: string, gameVersion: string, profile: string) =>
  invoke<ContentInstall>('install_mod', { project, gameVersion, profile })

export const installModpack = (slug: string) => invoke<Profile>('install_modpack', { slug })

export const installModpackVersion = (slug: string, versionId: string) =>
  invoke<Profile>('install_modpack_version', { slug, versionId })

export interface MigrateItem {
  file_name: string
  title: string
  project_id: string
  version_number: string
  ok: boolean
  note: string
}

export interface MigratePlan {
  items: MigrateItem[]
  ready: number
  missing: number
  unlinked: string[]
  suggested_name: string
}

export interface MigrateResult {
  profile: Profile
  moved: number
  failed: string[]
}

export const migratePlan = (profile: string, version: string, loader: string) =>
  invoke<MigratePlan>('migrate_plan', { profile, version, loader })

export const migrateProfile = (
  profile: string,
  version: string,
  loader: string,
  loaderVersion: string | null = null,
  name: string | null = null,
) => invoke<MigrateResult>('migrate_profile', { profile, version, loader, loaderVersion, name })

export const installVersion = (
  project: string,
  versionId: string,
  profile: string,
  kind: string,
  allowMismatch = false,
) => invoke<ContentInstall>('install_version', { project, versionId, profile, kind, allowMismatch })

// Names the account to play as; the core resolves the credentials itself.
export interface LaunchAuth {
  kind: 'microsoft'
  accountId?: string
  uuid?: string
  xuid?: string
}

export const launchGame = (version: string, nick: string, fabric: boolean, ramMb: number, auth: LaunchAuth) =>
  invoke<string>('launch_game', { version, nick, fabric, ramMb, auth })

export const launchProfile = (profile: string, nick: string, ramMb: number, auth: LaunchAuth) =>
  invoke<string>('launch_profile', { profile, nick, ramMb, auth })

export const listContent = (profile: string, kind: string) =>
  invoke<ModFile[]>('list_content', { profile, kind })

export const scanContentLocal = (profile: string, kind: string) =>
  invoke<ModFile[]>('scan_content_local', { profile, kind })

export const scanContent = (profile: string, kind: string) =>
  invoke<ScanResult>('scan_content', { profile, kind })

export const listLogs = (profile: string) => invoke<string[]>('list_logs', { profile })

export const listProfiles = () => invoke<Profile[]>('list_profiles')

export const listScreenshots = (profile: string) => invoke<string[]>('list_screenshots', { profile })

export const listServers = (profile: string) => invoke<ServerEntry[]>('list_servers', { profile })

export const listVersions = () => invoke<string[]>('list_versions')

export const listVersionsTyped = () => invoke<McVersion[]>('list_versions_typed')

export const listLoaderVersions = (loader: string, mcVersion: string) =>
  invoke<LoaderBuild[]>('list_loader_versions', { loader, mcVersion })

export const listWorldInstalls = (profile: string) => invoke<string[]>('list_world_installs', { profile })

export const listWorlds = (profile: string) => invoke<WorldEntry[]>('list_worlds', { profile })

export const loadProfileSettings = (profile: string) =>
  invoke<ProfileSettings>('load_profile_settings', { profile })

export interface FpsBoostState {
  enabled: boolean
  mods: string[]
  skipped: string[]
  flags: string[]
  video: boolean
  vanilla: boolean
  stale: boolean
  /** False for a catalogue pack that starts by its own description: the author tuned it. */
  applicable?: boolean
}

export const fpsBoostState = (profile: string) => invoke<FpsBoostState>('fps_boost_state', { profile })

export const setFpsBoost = (profile: string, on: boolean, keepOptions = false) =>
  invoke<FpsBoostState>('set_fps_boost', { profile, on, keepOptions })

export interface SessionStatus {
  accounts: Record<string, boolean>
}

export const sessionStatus = (accountIds: string[]) => invoke<SessionStatus>('session_status', { accountIds })

export const modpackInfo = (profile: string) => invoke<ModpackInfo>('modpack_info', { profile })

export const modpackVersions = (slug: string) => invoke<ModpackVersion[]>('modpack_versions', { slug })

export const msDevicePoll = (deviceCode: string) => invoke<DevicePoll>('ms_device_poll', { deviceCode })

export const msDeviceStart = () => invoke<DeviceStart>('ms_device_start')

export const mcTextures = (query: string) => invoke<McTextures>('mc_textures', { query })

// Binds the tokens the core kept from the finished login to the account row.
export const msSessionCommit = (deviceCode: string, accountId: string) =>
  invoke<void>('ms_session_commit', { deviceCode, accountId })

export const msSessionRefresh = (accountId: string) => invoke<MsSessionResult>('ms_session_refresh', { accountId })

export const msSessionValidate = (accountId: string) => invoke<MsSessionResult>('ms_session_validate', { accountId })

export const msSessionForget = (accountId: string) => invoke<void>('ms_session_forget', { accountId })

export const elyDeviceStart = () => invoke<DeviceStart>('ely_device_start')

export const elyDevicePoll = (deviceCode: string) => invoke<DevicePoll>('ely_device_poll', { deviceCode })

export const elySessionCommit = (deviceCode: string, accountId: string) =>
  invoke<void>('ely_session_commit', { deviceCode, accountId })

export interface MsCape {
  id: string
  alias: string
  url: string | null
  active: boolean
}

export interface MsProfile {
  uuid: string
  nick: string
  skin: string | null
  slim: boolean
  capes: MsCape[]
}

export const msProfile = (accountId: string) => invoke<MsProfile>('ms_profile', { accountId })

export const msResetSkin = (accountId: string) => invoke<unknown>('ms_reset_skin', { accountId })

export const msSetCape = (accountId: string, capeId: string) => invoke<unknown>('ms_set_cape', { accountId, capeId })

export const msUploadSkin = (accountId: string, pngBase64: string, slim: boolean) =>
  invoke<{ skin: string | null }>('ms_upload_skin', { accountId, pngBase64, slim })

export const openProfileFolder = (name: string) => invoke<void>('open_profile_folder', { name })

export const openScreenshots = (profile: string) => invoke<void>('open_screenshots', { profile })

export const openUrl = (url: string) =>
  invoke<void>('open_url', { url }).catch((e) => showToast('Не удалось открыть ссылку: ' + e, 'error'))

export const cancelLaunch = () => invoke<void>('cancel_launch')

export const stopGame = (profile?: string | null) => invoke<void>('stop_game', { profile: profile || null })

export const runningGames = () => invoke<string[]>('running_games')

export const gameDir = () => invoke<string>('game_dir')

export const setGameDir = (path: string, moveData: boolean) => invoke<string>('set_game_dir', { path, moveData })

export const pickGameDir = () => invoke<string | null>('pick_game_dir')
export interface CustomWallpaperFile {
  kind: string
  path: string
  name: string
}
export const pickWallpaper = () => invoke<CustomWallpaperFile | null>('pick_wallpaper')
export interface PickedTextureFile {
  name: string
  data: string
}
export const pickTexture = () => invoke<PickedTextureFile | null>('pick_texture')

export const openGameFolder = () => invoke<void>('open_game_folder')

export const quickPlay = (
  profile: string,
  nick: string,
  ramMb: number,
  world: string | null,
  server: string | null,
  auth?: LaunchAuth,
) => invoke<string>('quick_play', { profile, nick, ramMb, world, server, auth })

export const readLog = (profile: string, name: string) => invoke<string>('read_log', { profile, name })

export const removeServer = (profile: string, ip: string) =>
  invoke<ServerEntry[]>('remove_server', { profile, ip })

export const pinServerDat = (profile: string, name: string, ip: string) =>
  invoke<void>('pin_server_dat', { profile, name, ip })

export const saveProfileSettings = (
  profile: string,
  jvmArgs: string,
  width: number,
  height: number,
  javaPath: string,
) => invoke<void>('save_profile_settings', { profile, jvmArgs, width, height, javaPath })

export const setProfileGpu = (profile: string, pref: GpuPref) =>
  invoke<GpuPref>('set_profile_gpu', { profile, pref })

export const gpuSwitchSupported = () => invoke<boolean>('gpu_switch_supported')

export const setProfileJavaMajor = (profile: string, major: number | null) =>
  invoke<string>('set_profile_java_major', { profile, major })

export const scanImports = () => invoke<FoundInstance[]>('scan_imports')
export const planMoves = () => invoke<MoveCandidate[]>('plan_moves')
export const moveInstance = (path: string) => invoke<MoveOutcome>('move_instance', { path })
/** «Выбрать папку» в импорте: выбор папки и сборки в ней. null — диалог закрыли. */
export const pickImportDir = () => invoke<FoundInstance[] | null>('pick_import_dir')

export const setProfileGroup = (name: string, group: string) =>
  invoke<void>('set_profile_group', { name, group })

export const setProfileIcon = (name: string, icon: string) =>
  invoke<Profile[]>('set_profile_icon', { name, icon })

export const pickProfileCover = (profile: string) =>
  invoke<Profile[] | null>('pick_profile_cover', { profile })
// Cover for a build that does not exist yet: the New build dialog gets the
// image before there is a profile. null — the picker was dismissed.
export const pickCoverImage = () => invoke<string | null>('pick_cover_image')


export const clearProfileCover = (profile: string) => invoke<Profile[]>('clear_profile_cover', { profile })

export const shareLog = (profile: string, name: string) => invoke<string>('share_log', { profile, name })

export const testJava = (path: string) => invoke<string>('test_java', { path })

export const pickJavaPath = () => invoke<JavaInfo | null>('pick_java_path')

export const toggleContent = (profile: string, kind: string, name: string, enable: boolean) =>
  invoke<void>('toggle_content', { profile, kind, name, enable })

export const updateAll = (profile: string, kind: string) => invoke<number>('update_all', { profile, kind })

export const updateContent = (profile: string, kind: string, name: string) =>
  invoke<string>('update_content', { profile, kind, name })

export interface VersionChoice {
  id: string
  number: string
  channel: string
  date: string
  current: boolean
}

export const contentVersions = (profile: string, kind: string, name: string) =>
  invoke<VersionChoice[]>('content_versions', { profile, kind, name })

export const setContentVersion = (profile: string, kind: string, name: string, versionId: string) =>
  invoke<string>('set_content_version', { profile, kind, name, versionId })

export const updateModpack = (profile: string, versionId: string) =>
  invoke<Profile>('update_modpack', { profile, versionId })

export interface CrashEntry {
  file: string
  message: string
  details: string
  /** freeze — сторож интерфейса (не паника), panic — паника ядра. Старое ядро поля не шлёт. */
  kind?: 'freeze' | 'panic'
}

export const appVersion = () => invoke<string>('app_version')
/** Запуск вместе с системой: включён ли и включить/выключить (ответ — итог). */
export const autostartState = () => invoke<boolean>('autostart_state')
/** Иконка окна/панели задач/Dock: default | spark | gold | diamond. */
export const setAppIcon = (id: string) => invoke<void>('set_app_icon', { id })
export const autostartSet = (on: boolean) => invoke<boolean>('autostart_set', { on })

export interface DeviceSpecs {
  os: string
  os_version: string
  arch: string
  cpu: string
  cpu_cores: number
  cpu_threads: number
  ram_mb: number
}

export const deviceSpecs = () => invoke<DeviceSpecs>('device_specs')

/// Why the webview's render process died last time, reported once by the page
/// that came back after it.
export interface WebviewFailure {
  kind: string
  reason: string
  freeMb: number
  totalMb: number
  reloaded: boolean
}

export const takeWebviewFailure = () => invoke<WebviewFailure | null>('take_webview_failure')

export const setWebviewLowMemory = (on: boolean) => invoke<void>('set_webview_low_memory', { on })

// Flatpak builds are updated by flatpak itself, so the in-app channel is hidden.
export const isFlatpak = () => invoke<boolean>('is_flatpak')


// Обновление лаунчера через GitHub Releases (ядро: engine/core/selfupdate.rs).
export interface LauncherUpdate {
  version: string
  notes: string
  /** Страница релиза на GitHub — для ручной установки. */
  page: string
  url: string
  size: number
  sha256: string
}

export interface StagedUpdate {
  version: string
  path: string
}

export const updateCheck = (beta: boolean) => invoke<LauncherUpdate | null>('update_check', { beta })

/** Качает Copper-Setup.exe и сверяет sha256; ход — событием launcher-update-progress. */
export const updateStage = (beta: boolean) => invoke<StagedUpdate>('update_stage', { beta })

/** Запускает проверенный установщик; после этого лаунчер закрывается. */
export const updateRun = () => invoke<StagedUpdate>('update_run')


export const uiPrefs = () => invoke<Record<string, string>>('ui_prefs')

export const setUiPref = (key: string, value: string) => invoke<void>('set_ui_pref', { key, value })

// Liveness signal: without it the core treats the window as blank and reinstalls
// the launcher. Must be called once the UI actually mounted, not from main.
export const frontendReady = () => invoke<void>('frontend_ready').catch(() => {})

export const readCrashes = () => invoke<CrashEntry[]>('read_crashes')

export const clearCrashes = () => invoke<void>('clear_crashes')

export interface PingResult { online: number; max: number; motd: string; version: string; favicon: string | null; ms: number }
export const pingServer = (addr: string) => invoke<PingResult>('ping_server', { addr })
export interface RepairReport { checked: number; restored: number; broken: string[]; refused: string[] }
export const repairProfile = (profile: string) => invoke<RepairReport>('repair_profile', { profile })

// Textures live on disk: localStorage hit the webview quota and lost them silently.
export interface TextureEntry {
  file: string
  name: string
  slim: boolean
  slimManual: boolean
  data: string
}

export type TextureKind = 'skins' | 'capes'

export const listTextures = (kind: TextureKind) => invoke<TextureEntry[]>('list_textures', { kind })

export const saveTexture = (kind: TextureKind, name: string, data: string, slim: boolean) =>
  invoke<TextureEntry[]>('save_texture', { kind, name, data, slim })

// Downloaded by the core: the webview CSP blocks third-party hosts.
export const fetchTexture = (url: string) => invoke<string>('fetch_texture', { url })

// Returns the chosen path, or null when the save dialog was dismissed.
export const exportPng = (name: string, data: string) => invoke<string | null>('export_png', { name, data })

export const deleteTexture = (kind: TextureKind, file: string) =>
  invoke<TextureEntry[]>('delete_texture', { kind, file })

export const setTextureSlim = (kind: TextureKind, file: string, slim: boolean, manual: boolean) =>
  invoke<TextureEntry[]>('set_texture_slim', { kind, file, slim, manual })

// Served from the core cache, which survives restarts and rate-limits upstream.
export const headAvatar = (nick: string, size?: number) => invoke<string>('head_avatar', { nick, size })

export const cacheSize = () => invoke<number>('cache_size')
export const clearCache = () => invoke<number>('clear_cache')

export const trayAvailable = () => invoke<boolean>('tray_available')
export const hideToTray = () => invoke<void>('hide_to_tray')
export const showFromTray = () => invoke<void>('show_from_tray')
export const setRestoreOnExitNative = (on: boolean) => invoke<void>('set_restore_on_exit', { on })


// ---- Shared file store across builds ----

export interface DedupReport {
  files: number
  unique: number
  linked: number
  totalBytes: number
  savedBytes: number
  storeBytes: number
  note?: string
}

export const dedupeScan = () => invoke<DedupReport>('dedupe_scan')
export const dedupeRun = () => invoke<DedupReport>('dedupe_run')
export const dedupeGc = () => invoke<number>('dedupe_gc')

// ---- Auto-tuned memory and JVM flags ----

export interface Tuning {
  ramMb: number
  flags: string[]
  reasons: string[]
  totalRamMb: number
  mods: number
  shaders: boolean
  manualRamMb: number
}

export const tuneProfile = (profile: string) => invoke<Tuning>('tune_profile', { profile })
export const setAutoTune = (profile: string, on: boolean) => invoke<void>('set_auto_tune', { profile, on })

// ---- World manager ----

export interface WorldInfo {
  folder: string
  name: string
  lastPlayed: number
  sizeBytes: number
  icon: string
  mode: string
  hardcore: boolean
  cheats: boolean
  difficulty: string
  version: string
  seed: string
  backups: number
  unreadable: boolean
}

export const worldDetails = (profile: string) => invoke<WorldInfo[]>('world_details', { profile })
export const renameWorld = (profile: string, folder: string, name: string) =>
  invoke<WorldInfo>('rename_world', { profile, folder, name })
export const duplicateWorld = (profile: string, folder: string) =>
  invoke<WorldInfo>('duplicate_world', { profile, folder })
// null — the save dialog was dismissed
export const exportWorld = (profile: string, folder: string) =>
  invoke<string | null>('export_world', { profile, folder })
export const importWorld = (profile: string) => invoke<WorldInfo>('import_world', { profile })
export const restoreWorldBackup = (profile: string, file: string) =>
  invoke<WorldInfo>('restore_world_backup', { profile, file })
export const deleteWorldBackup = (profile: string, file: string) =>
  invoke<void>('delete_world_backup', { profile, file })
export const openWorldFolder = (profile: string, folder: string) =>
  invoke<void>('open_world_folder', { profile, folder })

// ---- Pictures in the viewer ----

// One of the two: a link the app itself rendered, or a file the launcher wrote.
export interface PictureRef {
  url?: string
  path?: string
}

export const copyPicture = (src: PictureRef) => invoke<void>('copy_picture', { src })
export const savePictureAs = (src: PictureRef) => invoke<string | null>('save_picture_as', { src })

// ---- Screenshot gallery ----

export interface Screenshot {
  profile: string
  name: string
  path: string
  sizeBytes: number
  takenAt: number
  width: number
  height: number
}

// An empty build name means screenshots of every build.
export const screenshotGallery = (profile: string) => invoke<Screenshot[]>('screenshot_gallery', { profile })
export const deleteScreenshot = (profile: string, name: string) =>
  invoke<void>('delete_screenshot', { profile, name })
export const saveScreenshotAs = (profile: string, name: string) =>
  invoke<string | null>('save_screenshot_as', { profile, name })
export const shareScreenshot = (profile: string, name: string) =>
  invoke<string>('share_screenshot', { profile, name })

// ---- Mod safety check ----

export interface ModVerdict {
  file: string
  title: string
  verdict: 'ok' | 'unknown' | 'suspicious' | 'blocked'
  reasons: string[]
  sha1: string
  source: string
  enabled: boolean
  size: number
}

export interface SafetyReport {
  profile: string
  checked: number
  ok: number
  unknown: number
  suspicious: number
  blocked: number
  items: ModVerdict[]
  checkedAt: number
  note?: string
}

export const scanModSafety = (profile: string) => invoke<SafetyReport>('scan_mod_safety', { profile })
export const quarantineMods = (profile: string, files: string[]) =>
  invoke<number>('quarantine_mods', { profile, files })

// ---- Crash diagnosis ----

export const applyCrashFix = (profile: string, kind: string, arg: string) =>
  invoke<string>('apply_crash_fix', { profile, kind, arg })

// ---- Sharing a build ----

// ---- Cloud sync ----

export const readSkinPng = (path: string) => invoke<string>('read_skin_png', { path })
