#!/usr/bin/env python3
"""Certification batch: for every distinct report of the given profiles, run
engine (reasons) -> evidence generation -> geometry harness, and write a
certification summary JSON. Gates 1+2 of the per-profile certification protocol."""
import json, os, glob, subprocess, sys, re

ROOT = os.getcwd()
SCRATCH = "/private/tmp/claude-501/-Users-operator-credit-clarify---gain-equity/5817f472-9600-4c26-bebd-98167fca0689/scratchpad"
SWEEP = "tmp/diagnostics/highlighter-s21/sweep"
PROFILES = sys.argv[1:] or ["experian_acr_v1"]

def latest_sessions(profile):
    best = {}
    for p in glob.glob('tmp/backend-sessions/*/outputs/result.json'):
        sid = p.split('/')[2]; ses = os.path.dirname(os.path.dirname(p))
        pdfs = glob.glob(f"{ses}/uploads/*.pdf")
        if not pdfs or not os.path.isdir(f"{ses}/ingestion/images"):
            continue
        try:
            r = json.load(open(p))
        except Exception:
            continue
        res = r.get('result') or {}
        if (res.get('profile') or '') != profile:
            continue
        name = os.path.basename(pdfs[0]); mt = os.path.getmtime(p)
        if name not in best or mt > best[name][0]:
            best[name] = (mt, sid, p, pdfs[0], f"{ses}/ingestion/images")
    return best

def harness_totals(draft, manifest):
    out = subprocess.run(["python3", "tmp/diagnostics/highlighter-s21/harness.py",
                          "--draft", draft, "--manifest", manifest],
                         capture_output=True, text=True, timeout=120).stdout
    tot = re.search(r"TOTALS: (.*)", out)
    exp = re.search(r"EXPORTABLE: (\S+)", out)
    return (tot.group(1) if tot else "?"), (exp.group(1) if exp else "?")

summary = {}
for profile in PROFILES:
    rows = []
    reports = latest_sessions(profile)
    print(f"\n##### {profile}: {len(reports)} reports #####", flush=True)
    for name, (_, sid, rpath, pdf, images) in sorted(reports.items()):
        tag = f"{profile.split('_')[0]}-{re.sub(r'[^A-Za-z0-9_-]', '_', name.replace('.pdf',''))[:34]}"
        reasons_out = f"{SWEEP}/{tag}.reasons.json"
        subprocess.run(["node", f"{SCRATCH}/engine-harness/sweep-one.mjs", rpath, sid, reasons_out],
                       capture_output=True, text=True, timeout=120)
        try:
            eng = json.load(open(reasons_out))
            assert eng.get('ok')
        except Exception:
            rows.append({"report": name, "status": "ENGINE-FAIL"}); print(f"ENGINE-FAIL {name}", flush=True); continue
        draft_path = f"{SWEEP}/{tag}.draft.json"
        json.dump({"sessionId": sid, "selectedReasons": eng["reasons"]}, open(draft_path, 'w'))
        outdir = f"{SWEEP}/{tag}.out"; os.makedirs(outdir, exist_ok=True)
        gen = subprocess.run(["python3", "server/dispute_evidence_generator.py", draft_path,
                              "--source-pdf", pdf, "--images-dir", images, "--output-dir", outdir,
                              "--result-json", rpath, "--session-id", sid,
                              "--highlighted-pdf-path", f"{outdir}/highlighted-report.pdf"],
                             capture_output=True, text=True, timeout=600)
        if gen.returncode != 0:
            rows.append({"report": name, "status": "GEN-FAIL", "err": gen.stderr[-200:]})
            print(f"GEN-FAIL {name}", flush=True); continue
        m = json.load(open(f"{outdir}/evidence-manifest.json"))
        modes = {}
        for r in m.get('reasons') or []:
            modes[r.get('resolutionMode')] = modes.get(r.get('resolutionMode'), 0) + 1
        totals, exportable = harness_totals(draft_path, f"{outdir}/evidence-manifest.json")
        row = {"report": name, "status": "ok", "reasons": eng['reasonCount'],
               "exportable": len(m.get('exportableReasonIds') or []),
               "unresolved": len(m.get('unresolvedReasonIds') or []),
               "modes": modes, "harness": totals, "exportRatio": exportable,
               "pdf": os.path.exists(f"{outdir}/highlighted-report.pdf")}
        rows.append(row)
        print(f"OK {name[:44]:<46} reasons={row['reasons']:>3} export={row['exportable']:>3} "
              f"unres={row['unresolved']} | {totals}", flush=True)
    summary[profile] = rows

json.dump(summary, open(f"{SWEEP}/certification-summary.json", 'w'), indent=1)
print("\nwritten:", f"{SWEEP}/certification-summary.json")
