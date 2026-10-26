# LaSalle 2026 scheduling analysis: blocked on Drive access

**Status (2026-10-26):** no team material could be read. `equip1.md` … `equip10.md` were **not** written, because writing them without the students' briefs and trackers would mean making the content up.

Source folder: "LaSalle/2026", `1E_VcdsaoBCCyN18Kk3BpLo0kOCBU7RND` (https://drive.google.com/drive/folders/1E_VcdsaoBCCyN18Kk3BpLo0kOCBU7RND)

## What was tried and what failed

### 1. Google Drive connector (MCP)
| Call | Result |
|---|---|
| `search_files` `parentId = '1E_VcdsaoBCCyN18Kk3BpLo0kOCBU7RND'` | `{}`: empty, no `nextPageToken` |
| `get_file_metadata` / `read_file_content` on the folder id | `Requested entity was not found.` |
| `search_files` `title contains 'Equip'` | `{}` plus a `nextPageToken`. Following the token returned `{}` |
| `search_files` `title contains 'Tracker'` | same: `{}` plus a token, then `{}` |
| `search_files` `mimeType = '...folder'` | same: `{}` plus a token, nothing else |
| `search_files` `sharedWithMe = true` | `{}` |
| `search_files` `owner = 'me'` | Only 7 files, all created by Claude/apps directly in My Drive (e.g. "CG Complexity Guide", "2026-09-10 Asset & Shot Complexities", `03_ficha_modulo.md`, `posts_2027`). None of the Equip folders, briefs or trackers |
| full-text search for "Asset Brief" / "Sequence Brief" | Only returns "CG Complexity Guide" |

**Diagnosis:** the connector still behaves like a *per-file (`drive.file`-style) grant*. It sees files the app created or that were explicitly opened through it, but not the rest of Drive. The "full permissions" change did not widen what this connector can see in a new session. The two reference docs (CG Complexity Guide, Asset & Shot Complexities) are readable. The students' folders are not.

### 2. Direct HTTP
```
curl https://drive.google.com/embeddedfolderview?id=1E_VcdsaoBCCyN18Kk3BpLo0kOCBU7RND
curl: (56) CONNECT tunnel failed, response 403
[agent-proxy] drive.google.com:443 — connect_rejected (host not allowed for this session)

curl https://docs.google.com/document/d/<id>/export?format=txt
curl: (56) CONNECT tunnel failed, response 403
```
The environment's network policy still blocks both `drive.google.com` and `docs.google.com`.

## How to unblock (any one is enough)

1. **Network allowlist (most direct):** in the cloud environment settings (environment menu in the session title bar → Edit → Network access), add `drive.google.com`, `docs.google.com` and `drive.usercontent.google.com` under Allowed domains, or pick a broader access level. Docs: https://code.claude.com/docs/en/cloud-environments#network-access. Then start a **new** session. The Equip folders must be viewable by anyone with the link, or the export URLs won't work without auth.
2. **Connector scope:** reconnect the Google Drive connector with full Drive read access, if the connector offers that option. If it does not, this route can't reach files the connector didn't create.
3. **Workaround with no settings change:** download each team's folder (Drive → right-click → Download gives a zip with docx/xlsx), then upload the zips to the session or commit them to a private repo or branch the session can read. The analysis can then run entirely offline.

Once one of these is in place, the original brief can be rerun unchanged.
