use crate::engine::*;
use std::path::{Path, PathBuf};

/// Файл аргументов java: длинная командная строка (большой classpath) уходит
/// в `@файл`, иначе Windows обрезает её на 32 тысячах символов.
const ARGFILE_NAME: &str = "copper-args.txt";
const ARG_LIMIT: usize = 30_000;

pub fn args_need_file(args: &[String]) -> bool {
    args.iter().map(|a| a.len() + 3).sum::<usize>() > ARG_LIMIT
}

pub fn write_argfile(game_dir: &Path, args: &[String]) -> Result<PathBuf, String> {
    let path = game_dir.join(ARGFILE_NAME);
    let body: String = args
        .iter()
        // Каждый аргумент в кавычках, кавычка экранирована, обратный слэш
        // заменён на прямой (java читает его как экранирование на любой
        // системе): иначе пробел или «#» в нике и пути дописывают аргументы.
        .map(|a| argfile_line(a))
        .collect();
    let fail = |e: std::io::Error| format!("Не удалось подготовить запуск сборки: {}", e);
    // В файле ключ подписи и токены запуска: читать его может только владелец
    // (аудит 24.09.2026). Старый файл удаляется, чтобы права взялись заново.
    let _ = std::fs::remove_file(&path);
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    let mut file = opts.open(&path).map_err(fail)?;
    std::io::Write::write_all(&mut file, &argfile_bytes(&body, ansi_codepage())).map_err(fail)?;
    Ok(path)
}

/// Байты файла аргументов в той кодировке, в которой его прочтёт java.
///
/// Лаунчер java на Windows читает `@файл` не как UTF-8, а в ANSI-кодировке
/// системы (у русской Windows это cp1251). Путь `C:/Users/Рустам/…`,
/// записанный в UTF-8, java видит как «РСѓСЃС‚Р°Рј» и не находит ни агент
/// входа, ни библиотеки: на телеметрии 24.09 это 340 из 425 упавших запусков
/// Arcania у игроков с кириллицей в имени пользователя. Если в строке есть
/// символ, которого в кодовой странице нет, файл остаётся в UTF-8 — хуже, чем
/// было, от этого не станет.
pub(crate) fn argfile_bytes(body: &str, codepage: Option<u32>) -> Vec<u8> {
    let Some(enc) = codepage.and_then(codepage_encoding) else { return body.as_bytes().to_vec() };
    if enc == encoding_rs::UTF_8 {
        return body.as_bytes().to_vec();
    }
    let (bytes, _, unmappable) = enc.encode(body);
    if unmappable {
        body.as_bytes().to_vec()
    } else {
        bytes.into_owned()
    }
}

fn codepage_encoding(cp: u32) -> Option<&'static encoding_rs::Encoding> {
    let label = match cp {
        65001 => "utf-8".to_string(),
        874 | 1250..=1258 => format!("windows-{}", cp),
        866 => "ibm866".into(),
        932 => "shift_jis".into(),
        936 => "gbk".into(),
        949 => "euc-kr".into(),
        950 => "big5".into(),
        _ => return None,
    };
    encoding_rs::Encoding::for_label(label.as_bytes())
}

#[cfg(windows)]
fn ansi_codepage() -> Option<u32> {
    extern "system" {
        fn GetACP() -> u32;
    }
    // SAFETY: GetACP не принимает аргументов и только читает настройку системы.
    Some(unsafe { GetACP() })
}

#[cfg(not(windows))]
fn ansi_codepage() -> Option<u32> {
    None
}

/// JVM читает файл аргументов при старте; через 10 секунд он уже не нужен и
/// не должен лежать на диске с ключом подписи.
pub fn drop_argfile_later(path: PathBuf) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(10));
        let _ = std::fs::remove_file(&path);
    });
}

/// Папка нативных библиотек под текущую систему.
///
/// Сборка кладёт их по подпапкам, и имена в ней не наши: у Arcania Windows
/// зовётся `mustdie`. Поэтому имя берётся из описания сборки, а не угадывается,

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pack_sized_classpath_goes_through_an_argfile() {
        let short: Vec<String> = vec!["-Xmx4G".into(), "-cp".into(), "a.jar;b.jar".into()];
        assert!(!args_need_file(&short), "обычный запуск не должен писать файл на диск");

        let long: Vec<String> = vec![
            "-cp".into(),
            // Длина как в жизни: профиль лежит в AppData, а имена защищённых
            // библиотек у сборки длинные — на них и набегают 80 000 символов.
            (0..400)
                .map(|i| {
                    format!(
                        "C:/Users/Player/AppData/Roaming/CopperLauncher/profiles/Arcania 1.4.3/libraries/com/ijm/iku/60.2/framework-terrain-manager-{}.7.57.jar",
                        i
                    )
                })
                .collect::<Vec<_>>()
                .join(";"),
        ];
        assert!(args_need_file(&long), "classpath из четырёхсот jar обязан уехать в файл");

        let dir = std::env::temp_dir().join("copper-argfile-test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = write_argfile(&dir, &long).expect("файл аргументов записан");
        let body = std::fs::read_to_string(&path).unwrap();
        // Именно обратный слэш, а не разделитель текущей системы: файл читает
        // java, и для неё он всегда означает экранирование — где бы мы его ни
        // записали.
        let backslash = char::from(92);
        assert!(
            !body.contains(backslash),
            "обратный слэш в файле аргументов java считает экранированием",
        );
        assert_eq!(body.lines().count(), long.len(), "каждый аргумент — своей строкой");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600, "файл с ключом подписи читает только владелец");
        }
        let _ = std::fs::remove_file(&path);
    }

    /// Русская Windows читает файл аргументов в cp1251: путь с кириллицей в
    /// UTF-8 превращался в кракозябры, и java не находила агент входа.
    #[test]
    fn argfile_is_written_in_the_ansi_code_page() {
        let body = "\"-javaagent:C:/Users/Рустам/AppData/Roaming/agents/authlib-injector.jar\"\n";
        let cp1251 = argfile_bytes(body, Some(1251));
        let (back, _, bad) = encoding_rs::WINDOWS_1251.decode(&cp1251);
        assert!(!bad);
        assert_eq!(back, body);
        assert_ne!(cp1251, body.as_bytes(), "кириллица обязана уйти однобайтной");
        assert_eq!(argfile_bytes("C:/Users/Ivan", Some(1251)), b"C:/Users/Ivan", "ASCII не меняется");
        // Нет кодовой страницы (не Windows) или UTF-8 в системе — как было.
        assert_eq!(argfile_bytes(body, None), body.as_bytes());
        assert_eq!(argfile_bytes(body, Some(65001)), body.as_bytes());
        // Символа нет в кодовой странице — UTF-8, а не «&#1056;» вместо буквы.
        assert_eq!(argfile_bytes("C:/Users/Рустам/中", Some(1251)), "C:/Users/Рустам/中".as_bytes());
        assert_eq!(argfile_bytes(body, Some(12345)), body.as_bytes(), "неизвестная страница — UTF-8");
    }
}
