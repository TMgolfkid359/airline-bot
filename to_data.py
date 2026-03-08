"""
ACARS Takeoff (TO) Data — structures and formatter per ACARS Takeoff Data Message spec.
Fields 1–25 align with the documented message layout (departure, env, reduced/max thrust, limits, notes).
"""

from dataclasses import dataclass, field
from typing import Optional, Any
import re


# --- Runway / airport ---

@dataclass
class DepartureRunway:
    """1. Departure airport and selected runway; *T PROC* if engine failure procedure exists."""
    airport: str
    runway: str
    t_proc: bool = False


# --- Environment (lines 3–8) ---

@dataclass
class TakeoffEnvironment:
    """3–8. Altitude, aircraft/engine, temp/altimeter, wind, TOCG/trim, runway condition."""
    climb_altitude_ft: Optional[int] = None  # 3 e.g. 16000 FT
    airplane_engine: str = ""  # 4 e.g. "737-800 CFM56-7B26"
    temp_c: Optional[float] = None  # 5
    altimeter_inhg: Optional[float] = None  # 5
    wind_mag_deg: Optional[int] = None  # 6
    wind_speed_kt: Optional[int] = None  # 6
    headwind_kt: Optional[int] = None  # 6
    crosswind_kt: Optional[int] = None  # 6
    tocg: Optional[float] = None  # 7 Takeoff CG
    trim: Optional[str] = None  # 7 Stabilizer trim (e.g. "-.--")
    runway_condition: str = "DRY"  # 8 default per spec


# --- Configuration (line 9) ---

@dataclass
class TakeoffConfiguration:
    """9. Flaps, bleeds, anti-ice. Flaps: 1, 5, 10, 15, or 25."""
    flaps: int = 1
    bleeds_on: bool = True
    anti_ice_off: bool = True


# --- Assumed conditions (10–11) ---

@dataclass
class AssumedConditions:
    """10–11. Assumed takeoff weight and assumed temperature for reduced thrust."""
    assumed_weight: Optional[float] = None  # 10 ASSMD WT (e.g. 164.6)
    assumed_temp_c: Optional[float] = None  # 11 ASSMD TMP (e.g. 32C)


# --- V-speeds row (used in 12 and 18) ---

@dataclass
class VSpeeds:
    """V1, VR, V2 (knots). First digit may be omitted in display (e.g. 50 = 150)."""
    v1: int
    vr: int
    v2: int


# --- Reduced thrust (12–16) ---

@dataclass
class ReducedThrustRow:
    """Single row of reduced thrust: N1 (%), headwind or tailwind, V-speeds, optional ATMP."""
    n1: Optional[float] = None  # 100+ may display as last two digits (e.g. 00 = 100)
    headwind_kt: Optional[int] = None  # line 12 *HW*
    tailwind_kt: Optional[int] = None  # 14=0, 15=5, 16=10
    assumed_temp_c: Optional[float] = None  # ATMP for TW lines
    v1: Optional[int] = None
    vr: Optional[int] = None
    v2: Optional[int] = None
    n1_display: Optional[str] = None  # e.g. "00" when N1 is 100


# --- Max thrust (17–18) ---

@dataclass
class MaxThrustData:
    """18. Max thrust N1, takeoff gross weight (TOG), V-speeds. EPR shown as dash."""
    n1: Optional[float] = None
    tog: Optional[float] = None  # ASSMD WT / TOG
    v1: Optional[int] = None
    vr: Optional[int] = None
    v2: Optional[int] = None


# --- Limits (19–22) ---

@dataclass
class TakeoffLimits:
    """19–22. Thrust reduction altitude, acceleration altitude, MTOG, VR MAX."""
    thr_red_ft_msl: Optional[int] = None  # 19 THR RED (climb thrust commanded)
    thr_red_afe_ft: Optional[int] = None  # 19 (AFE)
    acc_alt_ft_msl: Optional[int] = None  # 20 ACC ALT
    acc_alt_afe_ft: Optional[int] = None  # 20 (AFE)
    mtog: Optional[float] = None  # 21 For reference only; no data valid at MTOG
    vr_max: Optional[int] = None  # 22 Lesser of MTOG VR or actual TOGW VR + 20 kt


# --- MEL/CDL (23) ---

@dataclass
class MelCdlItem:
    """23. MEL/CDL penalty item (e.g. 2151R AIR CONDITIONING PACK)."""
    code: str = ""
    description: str = ""


# --- Partial runway (24) ---

@dataclass
class PartialRunwayCode:
    """24. Partial runway: runway/intersection, length, code (e.g. 16R/D12 15700FT 16RA). Not applicable to 737 per doc."""
    runway_intersection: str = ""
    length_ft: Optional[int] = None
    code: str = ""


# --- Notes / procedure (25) ---

@dataclass
class TakeoffNotes:
    """25. Engine failure on takeoff procedures; track/route (e.g. TRK RCL TO D4.0 S OF DEN VOR...)."""
    engine_failure_procedure: str = ""
    track_instructions: str = ""  # TRK, ACCEL ALT, etc.


# --- Full TO Data (all 25 conceptual fields) ---

@dataclass
class TOData:
    """
    Complete ACARS Takeoff Data (TO data) for one message.
    Maps to fields 1–25 of the ACARS Takeoff Data Message.
    """
    departure: DepartureRunway = field(default_factory=DepartureRunway)
    environment: TakeoffEnvironment = field(default_factory=TakeoffEnvironment)
    configuration: TakeoffConfiguration = field(default_factory=TakeoffConfiguration)
    assumed: AssumedConditions = field(default_factory=AssumedConditions)
    reduced_epr_row: Optional[ReducedThrustRow] = None  # 12 (main reduced thrust line)
    tw_epr_rows: list[ReducedThrustRow] = field(default_factory=list)  # 13–16 (0, 5, 10 kt TW)
    max_epr: Optional[MaxThrustData] = None  # 17–18
    limits: TakeoffLimits = field(default_factory=TakeoffLimits)
    mel_cdl: list[MelCdlItem] = field(default_factory=list)  # 23
    partial_runway_codes: list[PartialRunwayCode] = field(default_factory=list)  # 24
    notes: TakeoffNotes = field(default_factory=TakeoffNotes)  # 25
    reduced_thrust_na: bool = False  # If True, *REDUCED THRUST N/A* and 12–16 not displayed
    message_identifier: str = ""  # e.g. "737-7-001"

    def format_n1(self, n1: Optional[float]) -> str:
        """N1: if >= 100 show last two digits only (e.g. 100 -> 00)."""
        if n1 is None:
            return "--"
        if n1 >= 100:
            return f"{int(n1) % 100:02d}"
        return f"{n1:.1f}"

    def format_v_speeds_short(self, v1: Optional[int], vr: Optional[int], v2: Optional[int]) -> str:
        """V-speeds with first digit omitted (e.g. 155/166/169 -> 55/66/69)."""
        def short(v: Optional[int]) -> str:
            if v is None:
                return "--"
            return str(v)[-2:] if v >= 100 else str(v)
        return f"{short(v1)}/{short(vr)}/{short(v2)}"

    def format_v_speeds_full(self, v1: Optional[int], vr: Optional[int], v2: Optional[int]) -> str:
        """V-speeds full (e.g. 146 158 161)."""
        def vv(v: Optional[int]) -> str:
            return str(v) if v is not None else "--"
        return f"{vv(v1)} {vv(vr)} {vv(v2)}"

    def to_acars_lines(self) -> list[str]:
        """Produce the text lines of an ACARS Takeoff Data Message (approximate layout)."""
        lines = []
        dep = self.departure
        env = self.environment
        cfg = self.configuration
        ass = self.assumed
        lim = self.limits
        notes = self.notes

        # 1
        t_proc = " *T PROC*" if dep.t_proc else ""
        lines.append(f"T/O {dep.airport} {dep.runway}{t_proc}")

        # 3
        if env.climb_altitude_ft is not None:
            lines.append(f"{env.climb_altitude_ft} FT")

        # 4
        if env.airplane_engine:
            lines.append(env.airplane_engine)

        # 5
        temp_alt = []
        if env.temp_c is not None:
            temp_alt.append(f"TEMP {int(env.temp_c)}C")
        if env.altimeter_inhg is not None:
            temp_alt.append(f"ALT {env.altimeter_inhg:.2f}")
        if temp_alt:
            lines.append(" ".join(temp_alt))

        # 6
        wind_parts = []
        if env.wind_mag_deg is not None and env.wind_speed_kt is not None:
            wind_parts.append(f"WIND {env.wind_mag_deg:03d}/{env.wind_speed_kt} MAG {env.wind_speed_kt}KT")
        if env.headwind_kt is not None:
            wind_parts.append(f"HW {env.headwind_kt}KT")
        if env.crosswind_kt is not None:
            wind_parts.append(f"XW {env.crosswind_kt}KT")
        if wind_parts:
            lines.append(" ".join(wind_parts))

        # 7
        tocg_str = f"{env.tocg:.1f}" if env.tocg is not None else "-.--"
        trim_str = env.trim if env.trim else "-.--"
        lines.append(f"TOCG/TRIM {tocg_str}/{trim_str}")

        # 8
        lines.append(env.runway_condition)

        # 9
        aice = "OFF" if cfg.anti_ice_off else "ON"
        lines.append(f"*FLAPS {cfg.flaps}* *BLEEDS {'ON' if cfg.bleeds_on else 'OFF'}* *ANTI-ICE {aice}*")

        # 10–11
        if ass.assumed_weight is not None:
            lines.append(f"ASSMD WT: {ass.assumed_weight}")
        if ass.assumed_temp_c is not None and not self.reduced_thrust_na:
            lines.append(f"ASSMD TMP: {int(ass.assumed_temp_c)}C")

        if self.reduced_thrust_na:
            lines.append("*REDUCED THRUST N/A*")
        else:
            # 12 Reduced EPR (full V-speeds on this line)
            if self.reduced_epr_row:
                r = self.reduced_epr_row
                n1 = r.n1_display if r.n1_display is not None else (f"{r.n1:.1f}" if r.n1 is not None else "--")
                hw = f"{r.headwind_kt}KT" if r.headwind_kt is not None else "--"
                lines.append("REDUCED EPR ---")
                lines.append("N1 *HW* V1 VR V2")
                lines.append(f"{n1} {hw} {r.v1 or '--'} {r.vr or '--'} {r.v2 or '--'}")

            # 13–16 TW EPR (V-speeds first digit omitted)
            if self.tw_epr_rows:
                lines.append("TW EPR N1 ATMP V1/VR/V2")
                for r in self.tw_epr_rows:
                    n1 = r.n1_display if r.n1_display is not None else self.format_n1(r.n1)
                    atmp = f"{int(r.assumed_temp_c)}C" if r.assumed_temp_c is not None else "N/A"
                    if r.v1 is not None and r.vr is not None and r.v2 is not None:
                        vs = self.format_v_speeds_short(r.v1, r.vr, r.v2)
                    else:
                        vs = "N/A"
                    tw = r.tailwind_kt if r.tailwind_kt is not None else "N/A"
                    lines.append(f"{tw} -- {n1} {atmp} {vs}")

            # 17–18 MAX EPR
            if self.max_epr:
                m = self.max_epr
                lines.append("MAX EPR ---")
                lines.append("N1 TOG V1 VR V2")
                n1 = f"{m.n1:.1f}" if m.n1 is not None else "--"
                tog = m.tog if m.tog is not None else "--"
                vs = self.format_v_speeds_full(m.v1, m.vr, m.v2)
                lines.append(f"{n1} {tog} {vs}")

        # 19–22
        if lim.thr_red_ft_msl is not None and lim.thr_red_afe_ft is not None:
            lines.append(f"THR RED {lim.thr_red_ft_msl} ({lim.thr_red_afe_ft} AFE)")
        if lim.acc_alt_ft_msl is not None and lim.acc_alt_afe_ft is not None:
            lines.append(f"ACC ALT {lim.acc_alt_ft_msl} ({lim.acc_alt_afe_ft} AFE)")
        if lim.mtog is not None:
            lines.append(f"MTOG {lim.mtog}")
        if lim.vr_max is not None:
            lines.append(f"VR MAX {lim.vr_max}")

        # 23
        for item in self.mel_cdl:
            if item.code or item.description:
                lines.append(f"MEL/CDL {item.code} {item.description}".strip())

        # 24
        if self.partial_runway_codes:
            lines.append("PARTIAL RUNWAY CODES")
            for pr in self.partial_runway_codes:
                len_s = f"{pr.length_ft}FT" if pr.length_ft is not None else ""
                lines.append(f"{pr.runway_intersection} {len_s} {pr.code}".strip())

        # 25
        if notes.track_instructions:
            lines.append(notes.track_instructions)
        if notes.engine_failure_procedure:
            lines.append(notes.engine_failure_procedure)

        if self.message_identifier:
            lines.append(self.message_identifier)

        return lines

    def to_acars_message(self, separator: str = "\n") -> str:
        """Single string ACARS Takeoff Data Message."""
        return separator.join(self.to_acars_lines())


def make_example_to_data() -> TOData:
    """Build TO data matching the sample ACARS message (DEN 16R, 737-800, etc.)."""
    return TOData(
        departure=DepartureRunway(airport="DEN", runway="16R", t_proc=True),
        environment=TakeoffEnvironment(
            climb_altitude_ft=16000,
            airplane_engine="737-800 CFM56-7B26",
            temp_c=26,
            altimeter_inhg=29.88,
            wind_mag_deg=172,
            wind_speed_kt=8,
            headwind_kt=8,
            crosswind_kt=0,
            tocg=26.2,
            trim="-.--",
            runway_condition="DRY",
        ),
        configuration=TakeoffConfiguration(flaps=1, bleeds_on=True, anti_ice_off=True),
        assumed=AssumedConditions(assumed_weight=164.6, assumed_temp_c=32),
        reduced_epr_row=ReducedThrustRow(
            n1=99.4,
            headwind_kt=8,
            v1=155,
            vr=166,
            v2=169,
        ),
        tw_epr_rows=[
            ReducedThrustRow(tailwind_kt=0, n1=100, assumed_temp_c=30, v1=150, vr=162, v2=165),
            ReducedThrustRow(tailwind_kt=5, n1=101, assumed_temp_c=27, v1=146, vr=159, v2=162),
            ReducedThrustRow(tailwind_kt=10, n1=None, assumed_temp_c=None, v1=None, vr=None, v2=None),
        ],
        max_epr=MaxThrustData(n1=100.7, tog=164.6, v1=146, vr=158, v2=161),
        limits=TakeoffLimits(
            thr_red_ft_msl=6448,
            thr_red_afe_ft=1017,
            acc_alt_ft_msl=6448,
            acc_alt_afe_ft=1017,
            mtog=169.2,
            vr_max=167,
        ),
        mel_cdl=[MelCdlItem(code="2151R", description="AIR CONDITIONING PACK")],
        partial_runway_codes=[
            PartialRunwayCode("16R/D12", 15700, "16RA"),
            PartialRunwayCode("16R/D11", 14600, "16RB"),
            PartialRunwayCode("16R/WD", 12100, "16RD"),
        ],
        notes=TakeoffNotes(
            track_instructions="TRK RCL TO D4.0 S OF DEN VOR, TURN LT HDG 060 DEG. ACCEL ALT: 6300FT MSL/ 860FT AFE.",
        ),
        message_identifier="737-7-001",
    )


def _ofp_get(d: Any, path: str) -> Optional[Any]:
    """Get nested value from OFP dict. Path like 'origin > icao_code'. Handles _text and key case."""
    if d is None:
        return None
    keys = [k.strip() for k in path.split(">")]
    value = d
    for k in keys:
        if value is None:
            return None
        if not isinstance(value, dict):
            return None
        value = value.get(k) or value.get(k.lower()) or value.get(k.upper()) or value.get(k.capitalize())
        if value is not None and isinstance(value, dict) and "_text" in value and len(value) == 1:
            value = value["_text"]
    if value is not None and isinstance(value, str):
        value = value.strip() or None
    return value


def _ofp_num(s: Any) -> Optional[float]:
    """Parse number from OFP string (strip non-numeric except . -)."""
    if s is None:
        return None
    if isinstance(s, (int, float)) and not isinstance(s, bool):
        return float(s)
    raw = re.sub(r"[^\d.\-]", "", str(s))
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def to_data_from_ofp(flight_data: dict) -> TOData:
    """
    Build TOData from SimBrief OFP (Operational Flight Plan) flight_data.
    Uses the same field paths as the frontend (origin > icao_code, takeoff > v1, etc.).
    Missing or non-numeric values are left as None; message still formats with placeholders where applicable.
    """
    def get(path: str):
        return _ofp_get(flight_data, path)

    def get_any(*paths: str):
        for p in paths:
            v = get(p)
            if v is not None and v != "" and (not isinstance(v, str) or v.upper() != "N/A"):
                return v
        return None

    # Departure airport & runway (1)
    airport = (
        get_any("origin > icao_code", "origin > icao", "params > origin")
        or get("origin")
        or get("orig")
        or ""
    )
    if isinstance(airport, dict):
        airport = airport.get("_text") or airport.get("icao_code") or ""
    airport = str(airport).strip() if airport else ""

    runway_raw = get_any("origin > plan_rwy", "origin > rwy", "origin > runway", "params > origrwy", "origrwy")
    runway = str(runway_raw).strip() if runway_raw is not None else ""
    # T-PROC if SID/departure procedure exists
    sid = get_any("origin > sid", "origin > departure_procedure", "origin > sid_name")
    t_proc = bool(sid and str(sid).strip().upper() not in ("N/A", "[EDIT]", ""))

    # Environment (3–8)
    initial_alt = _ofp_num(get_any("general > initial_altitude", "params > altitude", "general > cruise_altitude"))
    climb_altitude_ft = int(initial_alt) if initial_alt is not None else None

    ac_name = get_any("aircraft > name", "aircraft > icao", "aircraft")
    ac_eng = get_any("aircraft > engines", "aircraft > engine_type", "params > aircraft")
    airplane_engine = f"{ac_name} {ac_eng}".strip() if (ac_name or ac_eng) else ""

    temp_c = _ofp_num(get_any("origin > temp", "origin > temperature", "params > temp"))
    altimeter_inhg = _ofp_num(get_any("origin > altimeter", "origin > qnh", "origin > pressure", "params > altimeter"))
    wind_mag_deg = _ofp_num(get_any("origin > wind_dir", "origin > wind_direction", "params > wind_dir"))
    wind_speed_kt = _ofp_num(get_any("origin > wind_spd", "origin > wind_speed", "params > wind_spd"))
    headwind_kt = _ofp_num(get_any("origin > headwind", "params > headwind"))
    crosswind_kt = _ofp_num(get_any("origin > crosswind", "params > crosswind"))
    tocg = _ofp_num(get_any("weights > cg", "weights > percent_cg", "weights > cg_percent"))
    trim_val = get_any("weights > trim", "weights > trim_setting", "weights > trim_value")
    trim = str(trim_val).strip() if trim_val is not None else None
    rwy_cond = get_any("origin > rwy_condition", "origin > runway_condition", "origin > surface") or "DRY"
    if isinstance(rwy_cond, str) and rwy_cond.upper() in ("N/A", "[EDIT]"):
        rwy_cond = "DRY"

    # Configuration (9)
    flaps_val = _ofp_num(get_any("takeoff > flaps", "takeoff > flap_setting", "params > flaps"))
    flaps = int(flaps_val) if flaps_val is not None else 1
    if flaps not in (1, 5, 10, 15, 25):
        flaps = 1

    # Assumed (10–11)
    assumed_weight = _ofp_num(get_any("weights > est_tow", "weights > tow", "weights > takeoff_weight", "params > tow"))
    assumed_temp_c = _ofp_num(get_any("takeoff > assumed_temp", "takeoff > flex_temp", "params > flex_temp"))

    # Limits (19–22)
    dep_elev = _ofp_num(get_any("origin > elevation", "origin > field_elevation")) or 0
    thr_red = _ofp_num(get_any("takeoff > thr_red_alt", "takeoff > thrust_reduction_altitude", "takeoff > thr_red"))
    acc_alt = _ofp_num(get_any("takeoff > accel_alt", "takeoff > acceleration_altitude", "takeoff > accel"))
    thr_red_afe = int(thr_red - dep_elev) if (thr_red is not None and dep_elev is not None) else None
    acc_alt_afe = int(acc_alt - dep_elev) if (acc_alt is not None and dep_elev is not None) else None
    mtog = _ofp_num(get_any("weights > mtow", "weights > max_takeoff_weight", "aircraft > mtow"))
    vr_max = _ofp_num(get_any("takeoff > vr_max", "takeoff > max_rotation"))

    # V-speeds from takeoff block
    v1 = _ofp_num(get_any("takeoff > v1", "takeoff > v1_speed"))
    vr = _ofp_num(get_any("takeoff > vr", "takeoff > rotation_speed", "takeoff > vr_speed"))
    v2 = _ofp_num(get_any("takeoff > v2", "takeoff > v2_speed"))
    v1_int = int(v1) if v1 is not None else None
    vr_int = int(vr) if vr is not None else None
    v2_int = int(v2) if v2 is not None else None

    reduced_na = not (v1_int and vr_int and v2_int)

    to_data = TOData(
        departure=DepartureRunway(airport=airport or "????", runway=runway or "??", t_proc=t_proc),
        environment=TakeoffEnvironment(
            climb_altitude_ft=climb_altitude_ft,
            airplane_engine=airplane_engine,
            temp_c=temp_c,
            altimeter_inhg=altimeter_inhg,
            wind_mag_deg=int(wind_mag_deg) if wind_mag_deg is not None else None,
            wind_speed_kt=int(wind_speed_kt) if wind_speed_kt is not None else None,
            headwind_kt=int(headwind_kt) if headwind_kt is not None else None,
            crosswind_kt=int(crosswind_kt) if crosswind_kt is not None else None,
            tocg=tocg,
            trim=trim or "-.--",
            runway_condition=rwy_cond,
        ),
        configuration=TakeoffConfiguration(flaps=flaps, bleeds_on=True, anti_ice_off=True),
        assumed=AssumedConditions(assumed_weight=assumed_weight, assumed_temp_c=assumed_temp_c),
        reduced_thrust_na=reduced_na,
        limits=TakeoffLimits(
            thr_red_ft_msl=int(thr_red) if thr_red is not None else None,
            thr_red_afe_ft=thr_red_afe,
            acc_alt_ft_msl=int(acc_alt) if acc_alt is not None else None,
            acc_alt_afe_ft=acc_alt_afe,
            mtog=mtog,
            vr_max=int(vr_max) if vr_max is not None else None,
        ),
        notes=TakeoffNotes(
            track_instructions=str(sid).strip() if sid else "",
        ),
    )

    if not reduced_na and (v1_int and vr_int and v2_int):
        to_data.reduced_epr_row = ReducedThrustRow(
            headwind_kt=int(headwind_kt) if headwind_kt is not None else None,
            v1=v1_int,
            vr=vr_int,
            v2=v2_int,
        )
        to_data.max_epr = MaxThrustData(
            tog=assumed_weight,
            v1=v1_int,
            vr=vr_int,
            v2=v2_int,
        )
        n1_reduced = _ofp_num(get_any("takeoff > reduced_epr_n1", "takeoff > reduced_n1"))
        if n1_reduced is not None:
            to_data.reduced_epr_row.n1 = n1_reduced
        n1_max = _ofp_num(get_any("takeoff > max_epr_n1", "takeoff > max_n1"))
        if n1_max is not None and to_data.max_epr:
            to_data.max_epr.n1 = n1_max

    return to_data
