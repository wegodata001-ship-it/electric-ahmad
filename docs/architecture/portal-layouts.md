# Portal Layout Architecture (frozen)

> **Do not change without explicit product approval.**

## Rule

| Portal | Kind | Layout | Shell | Content width |
|--------|------|--------|-------|---------------|
| System Manager | Desktop Back Office | **Admin** | `SystemAppShell` | `max-w-7xl` + wide sidebar |
| Project Manager | Portal | **Portal workspace** | `ProjectAppShell` | `max-w-6xl` + sidebar (not System Admin) |
| Operations | Portal | **Portal** | `OpsAppShell` | `max-w-lg` + bottom tabs |
| Field | Portal | **Portal** | `FieldAppShell` | `max-w-lg` + bottom tabs |
| Worker | Portal | **Portal** | `WorkerLayout` | `max-w-lg` + bottom tabs |
| Client | Portal | **Portal** | (portal shell only) | never Admin |

Markers: `data-layout="admin"` (System only) · `data-layout="portal"` (everyone else).

## Forbidden on Operations / Field / Worker / Client

- AdminLayout / SystemLayout / `SystemAppShell`
- `PortalShell` (deprecated)
- Full-bleed Admin (`max-w-7xl` system chrome)

## Project Manager

- Portal workspace (`max-w-6xl` + sidebar) — hub + performance / invoices / documents
- Accounts tab = charts only (not invoices workspace tree)
- Never System Admin full-bleed

## Allowed on System only

- Full-width Back Office (`SystemAppShell`, light theme)

## Wiring

| Route group | Layout file | Shell |
|-------------|-------------|-------|
| `(portals)/system` | `src/app/(portals)/system/layout.tsx` | `SystemAppShell` |
| `(portals)/project` | `src/app/(portals)/project/layout.tsx` | `ProjectAppShell` |
| `(portals)/operations` | `src/app/(portals)/operations/layout.tsx` | `OpsAppShell` |
| `(field)` | `src/app/(field)/layout.tsx` | `FieldAppShell` |
| `(worker)` | `src/app/(worker)/layout.tsx` | `WorkerLayout` |
| `(main)` legacy | `OfficePortalBridge` | role → System / Project / Ops shells |

## Dead / do-not-use

- `src/components/portal/portal-shell.tsx` — deprecated wide Admin; unused by portals
- `src/components/layout/field-layout.tsx` — deprecated wide Field desktop; replaced by `FieldAppShell`
