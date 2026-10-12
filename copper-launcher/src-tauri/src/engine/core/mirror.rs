// Downloads go directly to the content provider; no launcher relay.
pub(crate) const NO_LINK: &str = "нет связи";
pub(crate) fn abandon_direct(_route: &str, _err: &str) -> bool { false }
pub(crate) async fn routes(url: &str) -> Vec<String> { vec![url.to_owned()] }
pub(crate) async fn routes_round_trip(url: &str) -> Vec<String> { routes(url).await }
