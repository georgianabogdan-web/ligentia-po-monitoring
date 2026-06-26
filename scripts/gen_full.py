#!/usr/bin/env python3
"""Build the full 12-month Ligentia dataset (src/ligentiaData.json) from the
Snowflake extraction overflow file. Nothing here pulls rows into the model's
context — it reads the file, derives everything, and writes one JSON."""
import json, datetime, collections, sys

SRC = "/home/georgianabogdan5/.claude/projects/-home-georgianabogdan5/a72e0ba5-0edd-446a-98fe-b2eb99752607/tool-results/mcp-plugin_peak-platform_peak-warehouse-read_query-1782294810755.txt"
OUT = "/home/georgianabogdan5/ligentia-po-agent/src/ligentiaData.json"
TODAY = datetime.date(2026, 6, 24)

rows = json.load(open(SRC))["result"]

def d(s):
    if not s: return None
    try: return datetime.date.fromisoformat(s[:10])
    except Exception: return None

def ddmmyy(dt):
    return dt.strftime("%d/%m/%y") if dt else ""

CCY = {"USD": "$", "EUR": "€", "GBP": "£", "AUD": "A$"}
def money(total, ccy):
    sym = CCY.get(ccy, (ccy or "") + " ")
    try: return f"{sym}{round(float(total)):,}"
    except Exception: return f"{sym}0"

KW = [
    ("Refrigeration",        ["fridge","freezer","cooler","ice ","ice-","refriger","chiller","blast","bar cooler","display"]),
    ("Cooking Equipment",    ["toaster","fryer","griddle","oven","microwave","cooker","hob","induction","boiler","grill","kettle","steamer","range","hot ","bain marie","warmer","crepe","waffle"]),
    ("Food Prep Machines",   ["blender","mixer","processor","slicer","peeler","triturator","whisk","mincer","juicer","pasta"]),
    ("Tableware & Cutlery",  ["spoon","fork","knife","cutlery","plate","bowl","cup","mug","glass","tumbler","saucer","porcelain","crockery","teaspoon"]),
    ("Kitchen Supplies",     ["board","chopping","glove","mitt","apron","knife block","scale","whites","clothing"]),
    ("Disposables & Storage",["container","lid","straw","bin","packaging","wrap","foil","bag","gastronorm","jar","dredger","shaker","bucket"]),
    ("Furniture",            ["table","chair","stool","parasol","furniture","trolley","shelf","rack","umbrella","bolero"]),
]
def categorize(prod):
    p = (prod or "").lower()
    for cat, kws in KW:
        if any(k in p for k in kws): return cat
    return "Catering Equipment"

# ── 1. group rows by supplier; build PO records ──
by_sup = collections.defaultdict(list)
pos = []
for r in rows:
    sc = r["sc"]
    od, due, orig, act, eta = d(r["order_date"]), d(r["line_due"]), d(r["orig_due"]), d(r["actual_del"]), d(r["eta"])
    exf, org_exf = d(r["exf"]), d(r["org_exf"])
    has_cont, has_bk = int(r["has_cont"] or 0), int(r["has_bk"] or 0)
    by_sup[sc].append({"od": od, "due": due, "act": act})
    # status derivation (mirrors the Snowflake on_order logic)
    if act and act < TODAY:                               status = "Delivered"
    elif has_cont and eta and eta < TODAY:                status = "Late DC booking"
    elif has_cont and eta and eta >= TODAY:               status = "In Transit"
    elif exf and org_exf and exf > org_exf and not has_cont: status = "Ex-factory delay"
    elif due and orig and due > orig:                     status = "Date change required"
    elif has_bk:                                          status = "Acknowledged"
    elif od and (TODAY - od).days <= 21:                  status = "Sent to supplier"
    else:                                                 status = "On track"
    cat = categorize(r["prod"])
    total = r["total"] or 0
    problem = status in ("Ex-factory delay", "Date change required", "Late DC booking")
    priority = (float(total) >= 150000) or (problem and float(total) >= 50000)
    po = {
        "id": "PO-" + str(r["po"]),
        "supplierId": sc,
        "product": (r["prod"] or "").strip() or "Catering item",
        "category": cat,
        "createdOn": ddmmyy(od),
        "expectedDelivery": (orig or due).isoformat() if (orig or due) else (od.isoformat() if od else ""),
        "status": status,
        "priority": bool(priority),
        "quantity": int(r["qty"] or 0),
        "skus": int(r["skus"] or 0),
        "orderValue": money(total, r["ccy"]),
        "freight": "Air" if (r["mode"] or "").lower().startswith("air") else "Sea",
        "handledBy": "human" if status in ("Ex-factory delay", "Date change required") else "agent",
    }
    # real date-change record(s)
    dcs = []
    if due and orig and due > orig:
        days = (due - orig).days
        po["revisedDelivery"] = due.isoformat()
        po["expectedDelivery"] = orig.isoformat()
        dcs.append({"id": f"dc-{r['po']}-1", "fromDate": orig.isoformat(), "toDate": due.isoformat(),
                    "days": days, "causedBy": "supplier", "reasonCode": "capacity",
                    "reason": "Supplier rescheduled the delivery window.", "at": (orig - datetime.timedelta(days=14)).isoformat() + "T09:00:00Z"})
    if exf and org_exf and exf > org_exf:
        days = (exf - org_exf).days
        dcs.append({"id": f"dc-{r['po']}-x", "fromDate": org_exf.isoformat(), "toDate": exf.isoformat(),
                    "days": days, "causedBy": "supplier", "reasonCode": "capacity",
                    "reason": "Ex-factory date slipped against the original plan.", "at": org_exf.isoformat() + "T09:00:00Z"})
    if dcs: po["dateChanges"] = dcs
    pos.append(po)

# ── 2. supplier metrics (12-mo window = these rows) ──
def supplier_name(sc):
    for r in rows:
        if r["sc"] == sc: return r["sname"]
    return sc
def title(name):
    return name if any(c.islower() for c in name) else name.title()

def sup_trend(ot):
    return "improving" if ot >= 70 else ("stable" if ot >= 45 else "deteriorating")

sup_cat = {}
for po in pos:
    sup_cat.setdefault(po["supplierId"], collections.Counter())[po["category"]] += 1

suppliers = []
metrics = {}   # sc -> (ot, avg_delay, lead, trend)
for sc, recs in by_sup.items():
    delivered = [x for x in recs if x["act"]]
    open_pos = len(recs) - len(delivered)
    ot_vals = [1 if (x["act"] and x["due"] and x["act"] <= x["due"]) else 0 for x in delivered if x["due"]]
    ontime = round(100 * sum(ot_vals) / len(ot_vals)) if ot_vals else 50
    delays = [(x["act"] - x["due"]).days for x in delivered if x["due"]]
    avg_delay = round(sum(delays) / len(delays), 1) if delays else 0.0
    leads = [(x["due"] - x["od"]).days for x in recs if x["due"] and x["od"] and (x["due"] - x["od"]).days > 0]
    lead = round(sum(leads) / len(leads)) if leads else 90
    trend = sup_trend(ontime)
    cat = sup_cat[sc].most_common(1)[0][0] if sc in sup_cat else "Catering Equipment"
    suppliers.append({"id": sc, "name": title(supplier_name(sc)), "onTimeRate": ontime,
                      "avgDelayDays": avg_delay, "contractualLeadTimeDays": lead, "trend": trend,
                      "openPOs": open_pos, "category": cat})
    metrics[sc] = (ontime, avg_delay, lead, trend)

# ── 3. journey + fill profiles per supplier (anchored on real metrics) ──
STAGES = ["sample","fit","booking","handover","shipment","in_transit","customs","dc_arrival"]
INSTR = ["booking","handover","shipment","in_transit","customs","dc_arrival"]
TR = {"improving": "improving", "stable": "stable", "deteriorating": "worsening"}
MONTHS = ["Jan","Feb","Mar","Apr","May","Jun"]
def clamp(v, lo, hi): return max(lo, min(hi, int(round(v))))
def tier(ot):
    return "Excellent" if ot>=90 else "Good" if ot>=75 else "Watch" if ot>=60 else "At risk" if ot>=45 else "Critical"

journey, fill = {}, {}
for sc, (ot, ad, lead, trend) in metrics.items():
    weak = INSTR[sum(ord(c) for c in sc) % len(INSTR)]
    base = ad / 6.0
    byStage = {}
    for st in STAGES:
        if st in ("sample","fit"):
            byStage[st] = {"onTime": clamp(min(ot+12,97),60,99), "avgDelay": round(max(base*0.4,0.0),1), "trend": "stable"}
        elif st == weak:
            byStage[st] = {"onTime": clamp(ot-22,5,95), "avgDelay": round(base*1.8+1.0,1), "trend": "worsening"}
        else:
            byStage[st] = {"onTime": clamp(ot+4,5,97), "avgDelay": round(base*0.9,1), "trend": TR[trend]}
    hist = []
    for k, m in enumerate(MONTHS):
        if trend == "improving":      o = ot-(len(MONTHS)-1-k)*1.8; dl = ad+(len(MONTHS)-1-k)*0.5
        elif trend == "deteriorating":o = ot+(len(MONTHS)-1-k)*1.8; dl = ad-(len(MONTHS)-1-k)*0.6
        else:                          o = ot+((-1)**k); dl = ad
        vol = max(2, round(len(by_sup[sc]) / 6 * (0.8 + 0.08*k)))
        hist.append({"month": m, "onTime": clamp(o,3,99), "avgDelay": round(dl,1), "volume": vol})
    journey[sc] = {"tier": tier(ot),
                   "summary": f"{ot}% on-time overall; {weak.replace('_',' ')} is the weakest stage and the gating risk on open POs.",
                   "byStage": byStage, "history": hist}
    f = clamp(ot+25, 70, 98)
    vol_pts = clamp(20 - ot/8, 3, 16)
    fill[sc] = {"avgFillRatePct": f, "fillVolatilityPts": vol_pts,
                "trend": "worsening" if trend=="deteriorating" else ("improving" if trend=="improving" else "stable"),
                "posObserved": clamp(len(by_sup[sc])/2, 6, 20), "worstRecentPct": clamp(f-2*vol_pts, 40, 95)}

# ── 4. flagged-only PO events (point 4: don't hand-synthesise at scale) ──
events = {}
for po in pos:
    if po["status"] in ("Ex-factory delay","Date change required","Late DC booking") and "$" in po["orderValue"] and \
       int(po["orderValue"].replace("$","").replace(",","") or 0) >= 80000:
        sname = next((s["name"] for s in suppliers if s["id"] == po["supplierId"]), po["supplierId"])
        verb = {"Ex-factory delay":"ex-factory date passed with no dispatch confirmation",
                "Date change required":"requested a revised delivery date",
                "Late DC booking":"container arrived — DC delivery slot not yet booked"}[po["status"]]
        events[po["id"]] = [{"id": f"e-{po['id']}", "type": "chase_sent", "timestamp": "2026-06-10T09:00:00Z",
                             "body": f"Chase sent to {sname}. {po['product']} — {verb}.", "author": "agent"}]

kanban = [{
    "id": "A-101", "bucket": "intake-volume",
    "headline": "High intake week — w/c 22 Jun needs resourcing",
    "detail": "Containers scheduled to arrive at the AZTEC DC this week are well above the weekly average. Receiving may bottleneck without extra resource.",
    "suggestedAction": "Brief the AZTEC intake team and book additional unloading resource.",
    "metric": "Above-average intake",
}]

data = {"suppliers": suppliers, "supplierEmails": {}, "pos": pos,
        "journey": journey, "fill": fill, "events": events, "kanban": kanban}
# synth emails
import re
for s in suppliers:
    slug = re.sub(r"[^a-z0-9]", "", s["name"].lower())[:14] or s["id"].lower()
    data["supplierEmails"][s["id"]] = f"orders@{slug}.com"

json.dump(data, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))

# summary only (no row dump)
st = collections.Counter(p["status"] for p in pos)
print("POs:", len(pos), "| suppliers:", len(suppliers), "| events:", len(events))
print("status breakdown:", dict(st))
print("with dateChanges:", sum(1 for p in pos if "dateChanges" in p))
import os
print("JSON size: %.2f MB" % (os.path.getsize(OUT)/1e6))
