import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { bedrockJoin } from '../../ipc/commands'
import { api, mirrorAsset } from '../../lib/api'
import { plural } from '../../lib/format'
import { showToast } from '../../state/ui'
import type { RatingServer } from '../../state/servers'

/*
 * Bedrock-серверы рейтинга на экране игры Minecraft Bedrock (29.09.2026):
 * «Играть» открывает игру и сразу подключает (minecraft://connect,
 * engine/games::bedrock_join).
 */

type BedrockServer = RatingServer & { port?: number | null; bedrockIp?: string | null; bedrockPort?: number | null; edition?: string }

const SERVERS = 12

/** У BOTH-серверов Bedrock-адрес свой; у BEDROCK — основной адрес и порт. */
const address = (s: BedrockServer): { host: string; port: number } | null => {
  const host = s.bedrockIp || s.ip
  if (!host) return null
  const port = s.bedrockPort || (s.edition === 'BEDROCK' ? s.port : null) || 19132
  return { host, port }
}

export function BedrockServers({ on }: { on: boolean }) {
  const [servers, setServers] = useState<BedrockServer[] | null>(null)

  useEffect(() => {
    if (!on) return
    let alive = true
    api<{ servers?: BedrockServer[] }>('/rating/servers?limit=' + SERVERS + '&offset=0&sort=online&edition=BEDROCK')
      .then((r) => alive && setServers(r.servers || []))
      .catch(() => alive && setServers([]))
    return () => {
      alive = false
    }
  }, [on])

  const join = (s: BedrockServer) => {
    const a = address(s)
    if (!a) return
    bedrockJoin(a.host, a.port).catch((e) => showToast(String(e), 'error'))
  }

  return (
    <>
      {servers === null || servers.length ? (
        <section className="hub-sec">
          <div className="ph-shelf-head">
            <h2>Серверы Bedrock</h2>
          </div>
          <div className="hub-grid gm-bd-grid">
            {servers === null
              ? Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="ph-card skel-card" aria-hidden="true">
                    <span className="ph-card-art skel"></span>
                    <span className="ph-card-body">
                      <span className="skel skel-line" style={{ width: '60%' }}></span>
                    </span>
                  </span>
                ))
              : servers.map((s, i) => {
                  const a = address(s)
                  const art = s.bannerUrl || s.logoUrl
                  return (
                    <button
                      key={s.slug}
                      className="ph-card"
                      data-sound="play"
                      data-track="bedrock_join"
                      data-id={s.slug}
                      data-pos={i}
                      disabled={!a}
                      onClick={() => join(s)}
                    >
                      <span className={'ph-card-art' + (s.bannerUrl ? '' : ' gm-bd-logo')}>
                        {art ? (
                          <img
                            src={mirrorAsset(art)}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <Icon id="i-server" />
                        )}
                        <span className="gm-bd-play">
                          <Icon id="i-play" />
                        </span>
                      </span>
                      <span className="ph-card-body">
                        <b>{s.name}</b>
                        <span className="ph-card-meta">
                          {s.online ? s.online.toLocaleString('ru-RU') + ' ' + plural(s.online, 'игрок', 'игрока', 'игроков') : a ? a.host : ''}
                        </span>
                      </span>
                    </button>
                  )
                })}
          </div>
        </section>
      ) : null}
    </>
  )
}
