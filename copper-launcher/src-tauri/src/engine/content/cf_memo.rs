use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const ANSWER_TTL: Duration = Duration::from_secs(120);
const ANSWERS_MAX: usize = 128;

#[derive(Default)]
pub(crate) struct ProxyMemo {
    answers: HashMap<String, (Instant, Value)>,
}

impl ProxyMemo {
    pub(crate) fn answer(&mut self, key: &str, now: Instant) -> Option<Value> {
        match self.answers.get(key) {
            Some((at, v)) if now.duration_since(*at) < ANSWER_TTL => Some(v.clone()),
            Some(_) => {
                self.answers.remove(key);
                None
            }
            None => None,
        }
    }

    pub(crate) fn remember_answer(&mut self, key: &str, value: &Value, now: Instant) {
        if !self.answers.contains_key(key) && self.answers.len() >= ANSWERS_MAX {
            self.answers.retain(|_, (at, _)| now.duration_since(*at) < ANSWER_TTL);
            if self.answers.len() >= ANSWERS_MAX {
                if let Some(oldest) = self.answers.iter().min_by_key(|(_, (at, _))| *at).map(|(k, _)| k.clone()) {
                    self.answers.remove(&oldest);
                }
            }
        }
        self.answers.insert(key.to_string(), (now, value.clone()));
    }

}

/// Shared by every CurseForge call of the process: a popular pack asked by many
/// screens asks the mirror once.
pub(crate) fn cf_memo<T>(f: impl FnOnce(&mut ProxyMemo, Instant) -> T) -> T {
    static MEMO: OnceLock<Mutex<ProxyMemo>> = OnceLock::new();
    let mut guard = MEMO.get_or_init(Default::default).lock().unwrap_or_else(|e| e.into_inner());
    f(&mut guard, Instant::now())
}

pub(crate) fn cf_memo_key(path: &str, q: &[(String, String)]) -> String {
    let mut key = path.to_string();
    for (k, v) in q {
        key.push('&');
        key.push_str(k);
        key.push('=');
        key.push_str(v);
    }
    key
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answers_expire_and_stay_bounded() {
        let mut m = ProxyMemo::default();
        let t0 = Instant::now();
        let v = serde_json::json!({ "data": 1 });
        m.remember_answer("k", &v, t0);
        assert_eq!(m.answer("k", t0 + Duration::from_secs(1)), Some(v.clone()), "свежий ответ отдаётся из памяти");
        assert_eq!(m.answer("k", t0 + ANSWER_TTL), None, "старый ответ не должен жить дольше срока");
        for i in 0..(ANSWERS_MAX + 10) {
            m.remember_answer(&format!("k{i}"), &v, t0 + Duration::from_millis(i as u64));
        }
        assert!(m.answers.len() <= ANSWERS_MAX, "память ответов ограничена, иначе листание каталога растит её без конца");
        assert!(m.answer("k0", t0 + Duration::from_secs(1)).is_none(), "вытесняется самый старый ответ");
    }

    #[test]
    fn key_includes_query() {
        let q = vec![("slug".to_string(), "a".to_string())];
        assert_ne!(cf_memo_key("v1/mods/search", &q), cf_memo_key("v1/mods/search", &[]), "разные запросы поиска не должны делить ответ");
    }
}
