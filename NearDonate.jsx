import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Heart, MapPin, Package, Users, ShieldCheck, Plus, Check, X, Trash2, Edit2,
  Search, LogOut, ClipboardList, Truck, CheckCircle2, Clock, ImagePlus,
  Building2, User, ChevronRight, ChevronDown, Filter, Sparkles, Inbox,
  ArrowRight, AlertCircle, BadgeCheck, BadgeX, Eye, XCircle, PackageCheck,
  Menu, LayoutGrid, ListChecks,
} from "lucide-react";

/* =========================================================================
   DESIGN TOKENS
   Palette grounded in "hands, harvest, community" rather than SaaS default:
   deep forest for trust/growth, warm marigold for warmth/generosity,
   a cool paper surface (not the cliché cream) for calm legibility.
   ========================================================================= */
const C = {
  ink: "#151F19",
  inkSoft: "#4B564F",
  forest: "#1F3D2E",
  forestDeep: "#132A20",
  forestSoft: "#DCE6DE",
  gold: "#C98A2E",
  goldSoft: "#F3E3C4",
  rust: "#A6472A",
  rustSoft: "#F2DCD3",
  paper: "#F1F0E9",
  surface: "#FFFFFF",
  line: "#DEDCD0",
  lineSoft: "#EAE8DD",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');`;

/* =========================================================================
   REFERENCE DATA
   ========================================================================= */
const CITIES = [
  { name: "Virar", lat: 19.4550, lng: 72.8112 },
  { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
  { name: "Thane", lat: 19.2183, lng: 72.9781 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Nashik", lat: 20.0110, lng: 73.7903 },
  { name: "Surat", lat: 21.1702, lng: 72.8311 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Delhi", lat: 28.7041, lng: 77.1025 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
];

const CATEGORIES = [
  "Clothes", "Blankets", "School Bags", "Books", "Footwear", "Furniture",
  "Food Packets", "Household Items", "Toys", "Stationery", "Medical Supplies",
  "Electronics",
];

const CONDITIONS = ["New", "Like New", "Good", "Fair"];

const REQUEST_FLOW = ["PENDING", "ACCEPTED", "PICKUP_SCHEDULED", "COLLECTED", "COMPLETED"];

const STATUS_META = {
  PENDING: { label: "Requested", color: C.gold, bg: C.goldSoft, icon: Clock },
  ACCEPTED: { label: "Accepted", color: C.forest, bg: C.forestSoft, icon: Check },
  PICKUP_SCHEDULED: { label: "Pickup scheduled", color: "#2B5B8C", bg: "#DCE7F2", icon: Truck },
  COLLECTED: { label: "Collected", color: "#2B5B8C", bg: "#DCE7F2", icon: PackageCheck },
  COMPLETED: { label: "Completed", color: C.forest, bg: C.forestSoft, icon: CheckCircle2 },
  REJECTED: { label: "Declined", color: C.rust, bg: C.rustSoft, icon: XCircle },
  CANCELLED: { label: "Cancelled", color: C.inkSoft, bg: C.lineSoft, icon: X },
};

/* =========================================================================
   UTILITIES
   ========================================================================= */
function uid(prefix = "") {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v === undefined || v === null)) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function cityCoords(cityName) {
  const c = CITIES.find((c) => c.name === cityName);
  return c ? { lat: c.lat, lng: c.lng } : { lat: null, lng: null };
}

function resizeImageFile(file, maxWidth = 480, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* =========================================================================
   PERSISTENT STORAGE HELPERS
   ========================================================================= */
const SKEYS = {
  users: "neardonate:users",
  donations: "neardonate:donations",
  requirements: "neardonate:requirements",
  requests: "neardonate:requests",
};

async function storeGet(key) {
  try {
    const res = await window.storage.get(key, false);
    return res && res.value ? JSON.parse(res.value) : null;
  } catch {
    return null;
  }
}

async function storeSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
    return true;
  } catch {
    return false;
  }
}

/* =========================================================================
   DEMO SEED DATA
   ========================================================================= */
function seedData() {
  const now = Date.now();
  const day = 86400000;

  const users = [
    { id: "admin1", role: "admin", name: "Platform Admin", email: "admin@neardonate.org", password: "admin123", phone: "9999900000", createdAt: now - 60 * day },
    { id: "donor1", role: "donor", name: "Asha Kulkarni", email: "asha@example.com", password: "asha123", phone: "9820011223", city: "Virar", createdAt: now - 40 * day },
    { id: "donor2", role: "donor", name: "Rohan Mehta", email: "rohan@example.com", password: "rohan123", phone: "9820044556", city: "Mumbai", createdAt: now - 35 * day },
    {
      id: "ngo1", role: "ngo", name: "Priya Nair", email: "priya@sunshinetrust.org", password: "ngo123", phone: "9820077889",
      ngoProfile: { ngoName: "Sunshine Children's Trust", regNumber: "NGO/MH/2014/00981", address: "12 Station Road", city: "Virar", verified: true },
      createdAt: now - 50 * day,
    },
    {
      id: "ngo2", role: "ngo", name: "Vikram Rao", email: "vikram@hopefoundation.org", password: "ngo123", phone: "9820033445",
      ngoProfile: { ngoName: "Hope Foundation", regNumber: "NGO/MH/2019/04432", address: "45 MG Road", city: "Thane", verified: false },
      createdAt: now - 10 * day,
    },
  ];

  const donations = [
    { id: "d1", donorId: "donor1", category: "Blankets", itemName: "Winter Blankets", description: "Warm double-bed blankets, machine washed, no tears.", quantity: 25, availableQuantity: 25, condition: "Good", image: null, city: "Virar", ...cityCoords("Virar"), status: "AVAILABLE", createdAt: now - 5 * day },
    { id: "d2", donorId: "donor1", category: "School Bags", itemName: "School Bags", description: "Mixed-size school bags, mostly like-new, a couple with minor zipper wear.", quantity: 18, availableQuantity: 18, condition: "Like New", image: null, city: "Virar", ...cityCoords("Virar"), status: "AVAILABLE", createdAt: now - 4 * day },
    { id: "d3", donorId: "donor2", category: "Clothes", itemName: "Children's Clothes", description: "Ages 4-10, sorted by size, freshly laundered.", quantity: 40, availableQuantity: 40, condition: "Good", image: null, city: "Mumbai", ...cityCoords("Mumbai"), status: "AVAILABLE", createdAt: now - 6 * day },
    { id: "d4", donorId: "donor2", category: "Furniture", itemName: "Study Tables", description: "Wooden study tables, sturdy, minor surface scratches.", quantity: 10, availableQuantity: 10, condition: "Fair", image: null, city: "Mumbai", ...cityCoords("Mumbai"), status: "AVAILABLE", createdAt: now - 2 * day },
    { id: "d5", donorId: "donor1", category: "Books", itemName: "Story & Textbooks", description: "Mixed primary-school textbooks and story books.", quantity: 60, availableQuantity: 60, condition: "Good", image: null, city: "Virar", ...cityCoords("Virar"), status: "AVAILABLE", createdAt: now - 1 * day },
  ];

  const requirements = [
    { id: "r1", ngoId: "ngo1", category: "Blankets", itemName: "Blankets", requiredQuantity: 20, description: "Needed before winter for the shelter's 20 residents.", status: "OPEN", createdAt: now - 8 * day },
    { id: "r2", ngoId: "ngo1", category: "School Bags", itemName: "School Bags", requiredQuantity: 15, description: "For the new academic term enrolment drive.", status: "OPEN", createdAt: now - 7 * day },
    { id: "r3", ngoId: "ngo2", category: "Clothes", itemName: "Children's Clothes", requiredQuantity: 30, description: "Clothing drive for the Thane community centre.", status: "OPEN", createdAt: now - 3 * day },
  ];

  const requests = [
    { id: "q1", donationId: "d1", ngoId: "ngo1", requestedQuantity: 8, status: "ACCEPTED", requestedAt: now - 3 * day, updatedAt: now - 2 * day },
  ];
  donations[0].availableQuantity = 25 - 8;

  return { users, donations, requirements, requests };
}

/* =========================================================================
   SMALL UI PRIMITIVES
   ========================================================================= */
function Btn({ children, onClick, variant = "primary", size = "md", icon: Icon, disabled, type }) {
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm", lg: "px-5 py-2.5 text-base" };
  const base = "inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const style =
    variant === "primary"
      ? { backgroundColor: disabled ? C.line : C.forest, color: "#fff" }
      : variant === "gold"
      ? { backgroundColor: disabled ? C.line : C.gold, color: "#fff" }
      : variant === "danger"
      ? { backgroundColor: "transparent", color: C.rust, border: `1px solid ${C.rust}` }
      : variant === "ghost"
      ? { backgroundColor: "transparent", color: C.forest, border: `1px solid ${C.line}` }
      : { backgroundColor: "transparent", color: C.inkSoft };
  return (
    <button type={type || "button"} onClick={disabled ? undefined : onClick} disabled={disabled} className={`${base} ${sizes[size]}`} style={style}>
      {Icon && <Icon size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-sm mb-1.5" style={{ color: C.inkSoft, fontWeight: 500 }}>{label}</span>
      {children}
      {hint && <span className="block text-xs mt-1" style={{ color: C.inkSoft }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  border: `1px solid ${C.line}`,
  backgroundColor: C.surface,
  color: C.ink,
};
const inputClass = "w-full rounded px-3 py-2 text-sm outline-none focus:ring-2";

function TextInput(props) {
  return <input {...props} className={inputClass} style={{ ...inputStyle, ...(props.style || {}) }} onFocus={(e) => (e.target.style.borderColor = C.forest)} onBlur={(e) => (e.target.style.borderColor = C.line)} />;
}
function Select(props) {
  return <select {...props} className={inputClass} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function TextArea(props) {
  return <textarea {...props} className={inputClass} style={{ ...inputStyle, minHeight: 84, resize: "vertical", ...(props.style || {}) }} />;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(21,31,25,0.5)" }} onClick={onClose}>
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[88vh] overflow-y-auto rounded-lg shadow-xl`}
        style={{ backgroundColor: C.surface }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ backgroundColor: C.surface, borderBottom: `1px solid ${C.lineSoft}` }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 19, color: C.ink }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/5"><X size={18} color={C.inkSoft} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || { label: status, color: C.inkSoft, bg: C.lineSoft, icon: Clock };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: meta.bg, color: meta.color }}>
      <Icon size={12} /> {meta.label}
    </span>
  );
}

function EmptyState({ icon: Icon, title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-lg" style={{ border: `1px dashed ${C.line}` }}>
      <Icon size={28} color={C.inkSoft} />
      <p className="mt-3 font-medium" style={{ color: C.ink }}>{title}</p>
      {sub && <p className="mt-1 text-sm max-w-sm" style={{ color: C.inkSoft }}>{sub}</p>}
      {action}
    </div>
  );
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full shadow-lg text-sm font-medium flex items-center gap-2" style={{ backgroundColor: C.forestDeep, color: "#fff" }}>
      <CheckCircle2 size={15} /> {message}
    </div>
  );
}

/* =========================================================================
   ROOT APP
   ========================================================================= */
export default function NearDonateApp() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [donations, setDonations] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [requests, setRequests] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authView, setAuthView] = useState("landing"); // landing | login | register
  const [registerRole, setRegisterRole] = useState("donor");
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const notify = useCallback((msg) => setToast(msg), []);

  /* -------- initial load -------- */
  useEffect(() => {
    (async () => {
      const [u, d, r, q] = await Promise.all([
        storeGet(SKEYS.users), storeGet(SKEYS.donations), storeGet(SKEYS.requirements), storeGet(SKEYS.requests),
      ]);
      if (!u) {
        const seed = seedData();
        setUsers(seed.users);
        setDonations(seed.donations);
        setRequirements(seed.requirements);
        setRequests(seed.requests);
        await Promise.all([
          storeSet(SKEYS.users, seed.users),
          storeSet(SKEYS.donations, seed.donations),
          storeSet(SKEYS.requirements, seed.requirements),
          storeSet(SKEYS.requests, seed.requests),
        ]);
      } else {
        setUsers(u || []);
        setDonations(d || []);
        setRequirements(r || []);
        setRequests(q || []);
      }
      setLoading(false);
    })();
  }, []);

  /* -------- persistence helpers (write-through) -------- */
  const persistUsers = useCallback((next) => { setUsers(next); storeSet(SKEYS.users, next); }, []);
  const persistDonations = useCallback((next) => { setDonations(next); storeSet(SKEYS.donations, next); }, []);
  const persistRequirements = useCallback((next) => { setRequirements(next); storeSet(SKEYS.requirements, next); }, []);
  const persistRequests = useCallback((next) => { setRequests(next); storeSet(SKEYS.requests, next); }, []);

  /* -------- auth -------- */
  function handleLogin(email, password) {
    const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (!u) return "No account matches that email and password.";
    setCurrentUser(u);
    setAuthView("landing");
    return null;
  }

  function handleLogout() {
    setCurrentUser(null);
    setAuthView("landing");
  }

  function handleRegister(payload) {
    if (users.some((x) => x.email.toLowerCase() === payload.email.toLowerCase())) {
      return "An account with this email already exists.";
    }
    const newUser = { id: uid("u"), createdAt: Date.now(), ...payload };
    const next = [...users, newUser];
    persistUsers(next);
    setCurrentUser(newUser);
    setAuthView("landing");
    notify("Account created — welcome to NearDonate.");
    return null;
  }

  /* -------- donation CRUD -------- */
  function addDonation(payload) {
    const coords = cityCoords(payload.city);
    const donation = {
      id: uid("d"), donorId: currentUser.id, status: "AVAILABLE",
      availableQuantity: Number(payload.quantity), createdAt: Date.now(),
      ...payload, ...coords, quantity: Number(payload.quantity),
    };
    persistDonations([donation, ...donations]);
    notify("Donation posted.");
  }

  function updateDonation(id, patch) {
    const next = donations.map((d) => (d.id === id ? { ...d, ...patch } : d));
    persistDonations(next);
    notify("Donation updated.");
  }

  function deleteDonation(id) {
    persistDonations(donations.filter((d) => d.id !== id));
    notify("Donation removed.");
  }

  function adminRemoveDonation(id) {
    updateDonation(id, { status: "REMOVED" });
    notify("Donation removed from listings.");
  }

  /* -------- requirement CRUD -------- */
  function addRequirement(payload) {
    const req = { id: uid("r"), ngoId: currentUser.id, status: "OPEN", createdAt: Date.now(), ...payload, requiredQuantity: Number(payload.requiredQuantity) };
    persistRequirements([req, ...requirements]);
    notify("Requirement added.");
  }
  function updateRequirement(id, patch) {
    persistRequirements(requirements.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function deleteRequirement(id) {
    persistRequirements(requirements.filter((r) => r.id !== id));
    notify("Requirement removed.");
  }

  /* -------- request lifecycle -------- */
  function createRequest(donation, qty) {
    const reqObj = {
      id: uid("q"), donationId: donation.id, ngoId: currentUser.id,
      requestedQuantity: Number(qty), status: "PENDING",
      requestedAt: Date.now(), updatedAt: Date.now(),
    };
    persistRequests([reqObj, ...requests]);
    notify("Request sent to donor.");
  }

  function advanceRequest(reqId, newStatus) {
    const target = requests.find((r) => r.id === reqId);
    if (!target) return;

    if (newStatus === "ACCEPTED") {
      const donation = donations.find((d) => d.id === target.donationId);
      if (donation) {
        const remaining = Math.max(0, donation.availableQuantity - target.requestedQuantity);
        updateDonation(donation.id, { availableQuantity: remaining, status: remaining <= 0 ? "CLOSED" : "AVAILABLE" });
      }
    }
    persistRequests(requests.map((r) => (r.id === reqId ? { ...r, status: newStatus, updatedAt: Date.now() } : r)));
    const label = STATUS_META[newStatus]?.label || newStatus;
    notify(`Request marked "${label}".`);
  }

  /* -------- derived lookups -------- */
  const donationsById = useMemo(() => Object.fromEntries(donations.map((d) => [d.id, d])), [donations]);
  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center" style={{ backgroundColor: C.paper }}>
        <style>{FONT_IMPORT}</style>
        <div className="flex flex-col items-center gap-3">
          <Heart size={28} color={C.forest} className="animate-pulse" />
          <p style={{ color: C.inkSoft, fontFamily: "IBM Plex Sans, sans-serif" }} className="text-sm">Loading NearDonate…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: C.paper, minHeight: 640, fontFamily: "IBM Plex Sans, sans-serif", color: C.ink }} className="rounded-lg overflow-hidden">
      <style>{FONT_IMPORT}
      {`
        ::selection { background: ${C.goldSoft}; }
        .serif { font-family: 'Fraunces', serif; }
      `}</style>

      {!currentUser ? (
        <AuthArea
          authView={authView} setAuthView={setAuthView}
          registerRole={registerRole} setRegisterRole={setRegisterRole}
          onLogin={handleLogin} onRegister={handleRegister}
          demoUsers={users}
          setCurrentUser={(u) => setCurrentUser(u)}
        />
      ) : (
        <AppShell
          currentUser={currentUser}
          onLogout={handleLogout}
          mobileNavOpen={mobileNavOpen}
          setMobileNavOpen={setMobileNavOpen}
        >
          {currentUser.role === "donor" && (
            <DonorDashboard
              currentUser={currentUser}
              donations={donations.filter((d) => d.donorId === currentUser.id)}
              requests={requests}
              usersById={usersById}
              onAdd={addDonation}
              onUpdate={updateDonation}
              onDelete={deleteDonation}
              onAdvanceRequest={advanceRequest}
            />
          )}
          {currentUser.role === "ngo" && (
            <NgoDashboard
              currentUser={currentUser}
              donations={donations.filter((d) => d.status === "AVAILABLE" && d.availableQuantity > 0)}
              requirements={requirements.filter((r) => r.ngoId === currentUser.id)}
              requests={requests.filter((r) => r.ngoId === currentUser.id)}
              donationsById={donationsById}
              usersById={usersById}
              onAddRequirement={addRequirement}
              onUpdateRequirement={updateRequirement}
              onDeleteRequirement={deleteRequirement}
              onCreateRequest={createRequest}
              onCancelRequest={(id) => advanceRequest(id, "CANCELLED")}
            />
          )}
          {currentUser.role === "admin" && (
            <AdminDashboard
              users={users}
              donations={donations}
              requests={requests}
              donationsById={donationsById}
              usersById={usersById}
              onVerify={(id, verified) => persistUsers(users.map((u) => (u.id === id ? { ...u, ngoProfile: { ...u.ngoProfile, verified } } : u)))}
              onRemoveDonation={adminRemoveDonation}
            />
          )}
        </AppShell>
      )}
      <Toast message={toast} onDone={() => setToast("")} />
    </div>
  );
}

/* =========================================================================
   AUTH AREA (landing / login / register)
   ========================================================================= */
function AuthArea({ authView, setAuthView, registerRole, setRegisterRole, onLogin, onRegister, demoUsers, setCurrentUser }) {
  if (authView === "landing") {
    return <Landing onGetStarted={(role) => { setRegisterRole(role); setAuthView("register"); }} onLogin={() => setAuthView("login")} />;
  }
  if (authView === "login") {
    return <LoginScreen onLogin={onLogin} onBack={() => setAuthView("landing")} onGoRegister={() => setAuthView("register")} demoUsers={demoUsers} setCurrentUser={setCurrentUser} />;
  }
  return <RegisterScreen role={registerRole} setRole={setRegisterRole} onRegister={onRegister} onBack={() => setAuthView("landing")} onGoLogin={() => setAuthView("login")} />;
}

function Landing({ onGetStarted, onLogin }) {
  return (
    <div>
      {/* top bar */}
      <div className="flex items-center justify-between px-6 sm:px-10 py-5" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: C.forest }}>
            <Heart size={16} color={C.goldSoft} />
          </div>
          <span className="serif" style={{ fontSize: 20, color: C.ink }}>NearDonate</span>
        </div>
        <button onClick={onLogin} className="text-sm font-medium" style={{ color: C.forest }}>Sign in</button>
      </div>

      {/* hero */}
      <div className="px-6 sm:px-10 pt-14 pb-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-xs tracking-wide font-medium mb-4" style={{ color: C.gold }}>Community donation matching</p>
          <h1 className="serif" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1.1, color: C.ink }}>
            What you have, what they need, how far apart you are.
          </h1>
          <p className="mt-5 text-base max-w-md" style={{ color: C.inkSoft }}>
            NearDonate connects people who have usable clothes, books, blankets and household items with nearby NGOs that actually need them right now — matched by requirement and by distance, not just posted and hoped for.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Btn variant="primary" size="lg" icon={Package} onClick={() => onGetStarted("donor")}>I want to donate</Btn>
            <Btn variant="ghost" size="lg" icon={Building2} onClick={() => onGetStarted("ngo")}>I run an NGO</Btn>
          </div>
          <button onClick={onLogin} className="mt-5 text-sm underline" style={{ color: C.inkSoft }}>Already have an account? Sign in</button>
        </div>

        <div className="rounded-lg p-6" style={{ backgroundColor: C.forest }}>
          <p className="text-xs font-medium mb-4" style={{ color: C.goldSoft }}>RECOMMENDED FOR YOUR NGO</p>
          {[
            { item: "Blankets", qty: 25, dist: "2.1 km", match: true },
            { item: "Children's Clothes", qty: 40, dist: "3.4 km", match: true },
            { item: "Study Tables", qty: 10, dist: "8.7 km", match: false },
          ].map((r, i) => (
            <div key={i} className="rounded p-3.5 mb-2.5 last:mb-0 flex items-center justify-between" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
              <div>
                <p className="text-sm font-medium text-white">{r.item}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{r.qty} available · {r.dist} away</p>
              </div>
              {r.match ? (
                <span className="text-xs rounded-full px-2 py-1 font-medium" style={{ backgroundColor: C.gold, color: "#fff" }}>Match</span>
              ) : (
                <span className="text-xs rounded-full px-2 py-1 font-medium" style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>Other</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* how it works */}
      <div className="px-6 sm:px-10 pb-16">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { icon: Package, title: "Post what you have", body: "Item, quantity, condition, a photo, and your pickup location." },
            { icon: Sparkles, title: "We match it", body: "NGOs see donations that fit their stated needs, closest first." },
            { icon: Truck, title: "Coordinate pickup", body: "Accept a request, schedule pickup, mark it collected." },
          ].map((s, i) => (
            <div key={i} className="p-5 rounded-lg" style={{ border: `1px solid ${C.lineSoft}`, backgroundColor: C.surface }}>
              <s.icon size={20} color={C.forest} />
              <p className="mt-3 font-medium" style={{ color: C.ink }}>{s.title}</p>
              <p className="text-sm mt-1" style={{ color: C.inkSoft }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, onBack, onGoRegister, demoUsers, setCurrentUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit() {
    const err = onLogin(email, password);
    if (err) setError(err);
  }

  function quickLogin(e) {
    const u = demoUsers.find((x) => x.email === e);
    if (u) setCurrentUser(u);
  }

  return (
    <div className="min-h-[600px] flex items-center justify-center px-6 py-14">
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="text-sm mb-6" style={{ color: C.inkSoft }}>&larr; Back</button>
        <h2 className="serif" style={{ fontSize: 28, color: C.ink }}>Welcome back</h2>
        <p className="text-sm mt-1 mb-6" style={{ color: C.inkSoft }}>Sign in to your NearDonate account.</p>

        <Field label="Email">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        {error && <p className="text-sm mb-3" style={{ color: C.rust }}>{error}</p>}
        <Btn onClick={submit} size="lg">Sign in</Btn>
        <p className="text-sm mt-4" style={{ color: C.inkSoft }}>
          No account? <button onClick={onGoRegister} className="underline font-medium" style={{ color: C.forest }}>Register</button>
        </p>

        <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <p className="text-xs font-medium mb-3" style={{ color: C.inkSoft }}>TRY A DEMO ACCOUNT</p>
          <div className="flex flex-wrap gap-2">
            <Btn variant="ghost" size="sm" icon={User} onClick={() => quickLogin("asha@example.com")}>Demo donor</Btn>
            <Btn variant="ghost" size="sm" icon={Building2} onClick={() => quickLogin("priya@sunshinetrust.org")}>Demo NGO</Btn>
            <Btn variant="ghost" size="sm" icon={ShieldCheck} onClick={() => quickLogin("admin@neardonate.org")}>Demo admin</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterScreen({ role, setRole, onRegister, onBack, onGoLogin }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", city: CITIES[0].name, ngoName: "", regNumber: "", address: "" });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    if (!form.name || !form.email || !form.password || (role === "ngo" && !form.ngoName)) {
      setError("Please fill in all required fields.");
      return;
    }
    const payload =
      role === "donor"
        ? { role, name: form.name, email: form.email, phone: form.phone, password: form.password, city: form.city }
        : { role, name: form.name, email: form.email, phone: form.phone, password: form.password, ngoProfile: { ngoName: form.ngoName, regNumber: form.regNumber, address: form.address, city: form.city, verified: false } };
    const err = onRegister(payload);
    if (err) setError(err);
  }

  return (
    <div className="min-h-[600px] flex items-center justify-center px-6 py-14">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-sm mb-6" style={{ color: C.inkSoft }}>&larr; Back</button>
        <h2 className="serif" style={{ fontSize: 28, color: C.ink }}>Create your account</h2>
        <p className="text-sm mt-1 mb-5" style={{ color: C.inkSoft }}>Register as a donor or as an NGO.</p>

        <div className="flex rounded-lg overflow-hidden mb-6" style={{ border: `1px solid ${C.line}` }}>
          {["donor", "ngo"].map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className="flex-1 py-2.5 text-sm font-medium capitalize"
              style={role === r ? { backgroundColor: C.forest, color: "#fff" } : { backgroundColor: C.surface, color: C.inkSoft }}
            >
              {r === "ngo" ? "NGO" : "Donor"}
            </button>
          ))}
        </div>

        <Field label={role === "ngo" ? "Contact person name" : "Full name"}>
          <TextInput value={form.name} onChange={set("name")} placeholder="e.g. Asha Kulkarni" />
        </Field>
        {role === "ngo" && (
          <>
            <Field label="NGO name">
              <TextInput value={form.ngoName} onChange={set("ngoName")} placeholder="e.g. Sunshine Children's Trust" />
            </Field>
            <Field label="Registration number">
              <TextInput value={form.regNumber} onChange={set("regNumber")} placeholder="e.g. NGO/MH/2020/01234" />
            </Field>
            <Field label="Address">
              <TextInput value={form.address} onChange={set("address")} placeholder="Street, area" />
            </Field>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <TextInput type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
          </Field>
          <Field label="Phone">
            <TextInput value={form.phone} onChange={set("phone")} placeholder="10-digit number" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <Select value={form.city} onChange={set("city")}>
              {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Password">
            <TextInput type="password" value={form.password} onChange={set("password")} placeholder="••••••••" />
          </Field>
        </div>

        {error && <p className="text-sm mb-3" style={{ color: C.rust }}>{error}</p>}
        <Btn onClick={submit} size="lg">Create account</Btn>
        <p className="text-sm mt-4" style={{ color: C.inkSoft }}>
          Already registered? <button onClick={onGoLogin} className="underline font-medium" style={{ color: C.forest }}>Sign in</button>
        </p>
      </div>
    </div>
  );
}

/* =========================================================================
   APP SHELL (post-login layout: sidebar + topbar)
   ========================================================================= */
function AppShell({ currentUser, onLogout, children, mobileNavOpen, setMobileNavOpen }) {
  const roleLabel = currentUser.role === "ngo" ? currentUser.ngoProfile?.ngoName : currentUser.role === "admin" ? "Administrator" : "Donor";
  return (
    <div>
      <div className="flex items-center justify-between px-5 sm:px-8 py-4" style={{ borderBottom: `1px solid ${C.lineSoft}`, backgroundColor: C.surface }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: C.forest }}>
            <Heart size={14} color={C.goldSoft} />
          </div>
          <span className="serif" style={{ fontSize: 18, color: C.ink }}>NearDonate</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-tight" style={{ color: C.ink }}>{currentUser.name}</p>
            <p className="text-xs leading-tight" style={{ color: C.inkSoft }}>{roleLabel}</p>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: C.forestSoft, color: C.forest }}>
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <button onClick={onLogout} className="p-2 rounded hover:bg-black/5" title="Log out">
            <LogOut size={16} color={C.inkSoft} />
          </button>
        </div>
      </div>
      <div className="px-4 sm:px-8 py-6">{children}</div>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 mb-6 overflow-x-auto pb-1" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 -mb-px"
          style={
            active === t.key
              ? { color: C.forest, borderBottom: `2px solid ${C.forest}` }
              : { color: C.inkSoft, borderBottom: "2px solid transparent" }
          }
        >
          {t.icon && <t.icon size={14} />}
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="text-xs rounded-full px-1.5 py-0.5" style={active === t.key ? { backgroundColor: C.forestSoft, color: C.forest } : { backgroundColor: C.lineSoft, color: C.inkSoft }}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}` }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: C.inkSoft }}>{label}</p>
        <Icon size={15} color={accent || C.gold} />
      </div>
      <p className="serif mt-1.5" style={{ fontSize: 26, color: C.ink }}>{value}</p>
    </div>
  );
}

/* =========================================================================
   DONOR DASHBOARD
   ========================================================================= */
function DonorDashboard({ currentUser, donations, requests, usersById, onAdd, onUpdate, onDelete, onAdvanceRequest }) {
  const [tab, setTab] = useState("donations");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const myDonationIds = new Set(donations.map((d) => d.id));
  const myRequests = requests.filter((r) => myDonationIds.has(r.donationId));
  const pendingCount = myRequests.filter((r) => r.status === "PENDING").length;

  const active = donations.filter((d) => d.status === "AVAILABLE").length;
  const completedRequests = myRequests.filter((r) => r.status === "COMPLETED").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="serif" style={{ fontSize: 26, color: C.ink }}>Hello, {currentUser.name.split(" ")[0]}</h1>
        <p className="text-sm mt-1" style={{ color: C.inkSoft }}>Manage what you're giving away and coordinate pickups with NGOs.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Active donations" value={active} icon={Package} />
        <StatCard label="Total posted" value={donations.length} icon={ClipboardList} />
        <StatCard label="Pending requests" value={pendingCount} icon={Clock} accent={C.rust} />
        <StatCard label="Completed" value={completedRequests} icon={CheckCircle2} />
      </div>

      <Tabs
        active={tab} onChange={setTab}
        tabs={[
          { key: "donations", label: "My donations", icon: Package, count: donations.length },
          { key: "requests", label: "Requests", icon: Inbox, count: pendingCount },
        ]}
      />

      {tab === "donations" && (
        <div>
          <div className="flex justify-end mb-4">
            <Btn icon={Plus} onClick={() => setShowAdd(true)}>Post a donation</Btn>
          </div>
          {donations.length === 0 ? (
            <EmptyState icon={Package} title="No donations yet" sub="Post an item you'd like to give away — clothes, books, blankets, furniture, anything usable." action={<div className="mt-4"><Btn icon={Plus} onClick={() => setShowAdd(true)}>Post a donation</Btn></div>} />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {donations.map((d) => (
                <DonationOwnerCard key={d.id} donation={d} onEdit={() => setEditing(d)} onDelete={() => onDelete(d.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "requests" && (
        <DonorRequestsList requests={myRequests} donationsById={Object.fromEntries(donations.map((d) => [d.id, d]))} usersById={usersById} onAdvance={onAdvanceRequest} />
      )}

      {showAdd && <DonationFormModal onClose={() => setShowAdd(false)} onSubmit={(payload) => { onAdd(payload); setShowAdd(false); }} />}
      {editing && (
        <DonationFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => { onUpdate(editing.id, payload); setEditing(null); }}
        />
      )}
    </div>
  );
}

function DonationOwnerCard({ donation, onEdit, onDelete }) {
  const isClosed = donation.status !== "AVAILABLE";
  return (
    <div className="rounded-lg overflow-hidden flex flex-col" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}` }}>
      <div className="h-32 flex items-center justify-center" style={{ backgroundColor: C.forestSoft }}>
        {donation.image ? <img src={donation.image} alt={donation.itemName} className="w-full h-full object-cover" /> : <Package size={26} color={C.forest} />}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium" style={{ color: C.ink }}>{donation.itemName}</p>
          <span className="text-xs rounded-full px-2 py-0.5 shrink-0" style={{ backgroundColor: isClosed ? C.lineSoft : C.forestSoft, color: isClosed ? C.inkSoft : C.forest }}>
            {donation.status === "CLOSED" ? "Fulfilled" : donation.status === "REMOVED" ? "Removed" : "Available"}
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: C.inkSoft }}>{donation.category} · {donation.condition}</p>
        <p className="text-sm mt-2" style={{ color: C.inkSoft }}>{donation.availableQuantity} / {donation.quantity} available · {donation.city}</p>
        <div className="mt-auto pt-3 flex gap-2">
          <Btn variant="ghost" size="sm" icon={Edit2} onClick={onEdit} disabled={isClosed}>Edit</Btn>
          <Btn variant="danger" size="sm" icon={Trash2} onClick={onDelete}>Delete</Btn>
        </div>
      </div>
    </div>
  );
}

function DonationFormModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState(
    initial
      ? { itemName: initial.itemName, category: initial.category, quantity: initial.quantity, condition: initial.condition, description: initial.description, city: initial.city, image: initial.image }
      : { itemName: "", category: CATEGORIES[0], quantity: "", condition: CONDITIONS[0], description: "", city: CITIES[0].name, image: null }
  );
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await resizeImageFile(file);
      setForm((f) => ({ ...f, image: dataUrl }));
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (!form.itemName || !form.quantity) return;
    onSubmit(form);
  }

  return (
    <Modal title={initial ? "Edit donation" : "Post a donation"} onClose={onClose}>
      <Field label="Item name">
        <TextInput value={form.itemName} onChange={set("itemName")} placeholder="e.g. Winter Blankets" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={form.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Condition">
          <Select value={form.condition} onChange={set("condition")}>
            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity">
          <TextInput type="number" min="1" value={form.quantity} onChange={set("quantity")} placeholder="e.g. 20" />
        </Field>
        <Field label="Pickup city">
          <Select value={form.city} onChange={set("city")}>
            {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Description">
        <TextArea value={form.description} onChange={set("description")} placeholder="Condition details, sizes, anything an NGO should know." />
      </Field>
      <Field label="Photo (optional)">
        <div className="flex items-center gap-3">
          {form.image && <img src={form.image} alt="preview" className="w-14 h-14 rounded object-cover" style={{ border: `1px solid ${C.line}` }} />}
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm" style={{ border: `1px solid ${C.line}`, color: C.forest }}>
              <ImagePlus size={14} /> {busy ? "Processing…" : form.image ? "Change photo" : "Upload photo"}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </label>
        </div>
      </Field>
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit} icon={initial ? Check : Plus}>{initial ? "Save changes" : "Post donation"}</Btn>
      </div>
    </Modal>
  );
}

function DonorRequestsList({ requests, donationsById, usersById, onAdvance }) {
  if (requests.length === 0) {
    return <EmptyState icon={Inbox} title="No requests yet" sub="When an NGO requests one of your donations, it will show up here for you to accept or decline." />;
  }
  const sorted = [...requests].sort((a, b) => b.requestedAt - a.requestedAt);
  return (
    <div className="space-y-3">
      {sorted.map((r) => {
        const donation = donationsById[r.donationId];
        const ngo = usersById[r.ngoId];
        const ngoName = ngo?.ngoProfile?.ngoName || ngo?.name || "An NGO";
        const dist = donation && ngo?.ngoProfile ? haversineKm(donation.lat, donation.lng, cityCoords(ngo.ngoProfile.city).lat, cityCoords(ngo.ngoProfile.city).lng) : null;
        return (
          <div key={r.id} className="rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}` }}>
            <div>
              <p className="font-medium" style={{ color: C.ink }}>{ngoName} requested {r.requestedQuantity} × {donation?.itemName || "a donation"}</p>
              <p className="text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color: C.inkSoft }}>
                <span>{fmtDate(r.requestedAt)}</span>
                {dist !== null && <><span>·</span><MapPin size={11} className="inline" /> {dist.toFixed(1)} km away</>}
                {ngo?.ngoProfile && !ngo.ngoProfile.verified && <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: C.goldSoft, color: C.gold }}>Unverified NGO</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusPill status={r.status} />
              {r.status === "PENDING" && (
                <>
                  <Btn size="sm" icon={Check} onClick={() => onAdvance(r.id, "ACCEPTED")}>Accept</Btn>
                  <Btn size="sm" variant="danger" icon={X} onClick={() => onAdvance(r.id, "REJECTED")}>Decline</Btn>
                </>
              )}
              {r.status === "ACCEPTED" && <Btn size="sm" variant="gold" icon={Truck} onClick={() => onAdvance(r.id, "PICKUP_SCHEDULED")}>Schedule pickup</Btn>}
              {r.status === "PICKUP_SCHEDULED" && <Btn size="sm" variant="gold" icon={PackageCheck} onClick={() => onAdvance(r.id, "COLLECTED")}>Mark collected</Btn>}
              {r.status === "COLLECTED" && <Btn size="sm" icon={CheckCircle2} onClick={() => onAdvance(r.id, "COMPLETED")}>Mark completed</Btn>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================================
   NGO DASHBOARD
   ========================================================================= */
function NgoDashboard({ currentUser, donations, requirements, requests, donationsById, usersById, onAddRequirement, onUpdateRequirement, onDeleteRequirement, onCreateRequest, onCancelRequest }) {
  const [tab, setTab] = useState("recommended");
  const [showAddReq, setShowAddReq] = useState(false);
  const [requestDonation, setRequestDonation] = useState(null);

  const ngoCoords = cityCoords(currentUser.ngoProfile?.city);
  const openRequirements = requirements.filter((r) => r.status === "OPEN");

  const recommended = useMemo(() => {
    return donations
      .filter((d) => d.donorId !== currentUser.id)
      .map((d) => {
        const dist = haversineKm(ngoCoords.lat, ngoCoords.lng, d.lat, d.lng);
        const matched = openRequirements.find((r) => r.category === d.category);
        return { donation: d, distance: dist, matched: !!matched, matchLabel: matched?.itemName };
      })
      .sort((a, b) => {
        if (a.matched !== b.matched) return a.matched ? -1 : 1;
        return (a.distance ?? 999) - (b.distance ?? 999);
      });
  }, [donations, openRequirements, ngoCoords.lat, ngoCoords.lng, currentUser.id]);

  const matchCount = recommended.filter((r) => r.matched).length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="serif" style={{ fontSize: 26, color: C.ink }}>{currentUser.ngoProfile?.ngoName}</h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: C.inkSoft }}>
            <MapPin size={13} /> {currentUser.ngoProfile?.city}
            {currentUser.ngoProfile?.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: C.forestSoft, color: C.forest }}><BadgeCheck size={11} /> Verified</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: C.goldSoft, color: C.gold }}><BadgeX size={11} /> Pending verification</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Open requirements" value={openRequirements.length} icon={ListChecks} />
        <StatCard label="Matches nearby" value={matchCount} icon={Sparkles} accent={C.forest} />
        <StatCard label="Requests sent" value={requests.length} icon={ClipboardList} />
        <StatCard label="Completed" value={requests.filter((r) => r.status === "COMPLETED").length} icon={CheckCircle2} />
      </div>

      <Tabs
        active={tab} onChange={setTab}
        tabs={[
          { key: "recommended", label: "Recommended", icon: Sparkles, count: matchCount },
          { key: "requirements", label: "Requirements", icon: ListChecks, count: requirements.length },
          { key: "browse", label: "Browse all", icon: LayoutGrid },
          { key: "myrequests", label: "My requests", icon: Inbox, count: requests.filter((r) => r.status === "PENDING").length },
        ]}
      />

      {tab === "recommended" && (
        <RecommendedList items={recommended} onRequest={setRequestDonation} emptyHint="Add a requirement first, or check back as donors post nearby." />
      )}

      {tab === "requirements" && (
        <RequirementsPanel
          requirements={requirements}
          onAdd={() => setShowAddReq(true)}
          onToggle={(r) => onUpdateRequirement(r.id, { status: r.status === "OPEN" ? "FULFILLED" : "OPEN" })}
          onDelete={onDeleteRequirement}
        />
      )}

      {tab === "browse" && (
        <BrowseDonations donations={donations.filter((d) => d.donorId !== currentUser.id)} ngoCoords={ngoCoords} onRequest={setRequestDonation} />
      )}

      {tab === "myrequests" && (
        <NgoRequestsList requests={requests} donationsById={donationsById} usersById={usersById} onCancel={onCancelRequest} />
      )}

      {showAddReq && <RequirementFormModal onClose={() => setShowAddReq(false)} onSubmit={(p) => { onAddRequirement(p); setShowAddReq(false); }} />}
      {requestDonation && (
        <RequestFormModal donation={requestDonation} onClose={() => setRequestDonation(null)} onSubmit={(qty) => { onCreateRequest(requestDonation, qty); setRequestDonation(null); }} />
      )}
    </div>
  );
}

function RequirementsPanel({ requirements, onAdd, onToggle, onDelete }) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Btn icon={Plus} onClick={onAdd}>Add requirement</Btn>
      </div>
      {requirements.length === 0 ? (
        <EmptyState icon={ListChecks} title="No requirements listed" sub="Tell NearDonate what your NGO currently needs so donors' items get matched to you automatically." action={<div className="mt-4"><Btn icon={Plus} onClick={onAdd}>Add requirement</Btn></div>} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {requirements.map((r) => (
            <div key={r.id} className="rounded-lg p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}` }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium" style={{ color: C.ink }}>{r.itemName}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.inkSoft }}>{r.category} · need {r.requiredQuantity}</p>
                </div>
                <span className="text-xs rounded-full px-2 py-0.5 shrink-0" style={r.status === "OPEN" ? { backgroundColor: C.forestSoft, color: C.forest } : { backgroundColor: C.lineSoft, color: C.inkSoft }}>
                  {r.status === "OPEN" ? "Open" : "Fulfilled"}
                </span>
              </div>
              {r.description && <p className="text-sm mt-2" style={{ color: C.inkSoft }}>{r.description}</p>}
              <div className="flex gap-2 mt-3">
                <Btn variant="ghost" size="sm" onClick={() => onToggle(r)}>{r.status === "OPEN" ? "Mark fulfilled" : "Reopen"}</Btn>
                <Btn variant="danger" size="sm" icon={Trash2} onClick={() => onDelete(r.id)}>Remove</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RequirementFormModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ itemName: "", category: CATEGORIES[0], requiredQuantity: "", description: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title="Add a requirement" onClose={onClose}>
      <Field label="Item needed">
        <TextInput value={form.itemName} onChange={set("itemName")} placeholder="e.g. School Bags" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={form.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Quantity needed">
          <TextInput type="number" min="1" value={form.requiredQuantity} onChange={set("requiredQuantity")} placeholder="e.g. 30" />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <TextArea value={form.description} onChange={set("description")} placeholder="Who this is for, deadline, size range, etc." />
      </Field>
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn icon={Plus} onClick={() => form.itemName && form.requiredQuantity && onSubmit(form)}>Add requirement</Btn>
      </div>
    </Modal>
  );
}

function RecommendedList({ items, onRequest, emptyHint }) {
  if (items.length === 0) return <EmptyState icon={Sparkles} title="Nothing to recommend yet" sub={emptyHint} />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(({ donation, distance, matched, matchLabel }) => (
        <DonationBrowseCard key={donation.id} donation={donation} distance={distance} matched={matched} matchLabel={matchLabel} onRequest={() => onRequest(donation)} />
      ))}
    </div>
  );
}

function DonationBrowseCard({ donation, distance, matched, matchLabel, onRequest }) {
  return (
    <div className="rounded-lg overflow-hidden flex flex-col" style={{ backgroundColor: C.surface, border: `1px solid ${matched ? C.gold : C.lineSoft}`, ...(matched ? { boxShadow: `0 0 0 1px ${C.gold}` } : {}) }}>
      <div className="h-32 flex items-center justify-center relative" style={{ backgroundColor: C.forestSoft }}>
        {donation.image ? <img src={donation.image} alt={donation.itemName} className="w-full h-full object-cover" /> : <Package size={26} color={C.forest} />}
        {matched && (
          <span className="absolute top-2 right-2 text-xs rounded-full px-2 py-0.5 font-medium flex items-center gap-1" style={{ backgroundColor: C.gold, color: "#fff" }}>
            <Sparkles size={11} /> Match{matchLabel ? `: ${matchLabel}` : ""}
          </span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <p className="font-medium" style={{ color: C.ink }}>{donation.itemName}</p>
        <p className="text-xs mt-1" style={{ color: C.inkSoft }}>{donation.category} · {donation.condition}</p>
        <p className="text-sm mt-2 line-clamp-2" style={{ color: C.inkSoft }}>{donation.description}</p>
        <div className="flex items-center justify-between mt-3 text-sm">
          <span style={{ color: C.ink }}>{donation.availableQuantity} available</span>
          {distance !== null && <span className="flex items-center gap-1" style={{ color: C.inkSoft }}><MapPin size={12} /> {distance.toFixed(1)} km</span>}
        </div>
        <div className="mt-3">
          <Btn size="sm" onClick={onRequest} icon={ArrowRight}>Request</Btn>
        </div>
      </div>
    </div>
  );
}

function BrowseDonations({ donations, ngoCoords, onRequest }) {
  const [category, setCategory] = useState("All");
  const [condition, setCondition] = useState("All");
  const [search, setSearch] = useState("");
  const [sortByDistance, setSortByDistance] = useState(true);

  const filtered = useMemo(() => {
    let list = donations.map((d) => ({ donation: d, distance: haversineKm(ngoCoords.lat, ngoCoords.lng, d.lat, d.lng), matched: false }));
    if (category !== "All") list = list.filter((x) => x.donation.category === category);
    if (condition !== "All") list = list.filter((x) => x.donation.condition === condition);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((x) => x.donation.itemName.toLowerCase().includes(q) || x.donation.description.toLowerCase().includes(q));
    }
    if (sortByDistance) list.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
    return list;
  }, [donations, category, condition, search, sortByDistance, ngoCoords.lat, ngoCoords.lng]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" color={C.inkSoft} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className={inputClass} style={{ ...inputStyle, paddingLeft: 30, width: 200 }} />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "auto" }}>
          <option>All</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select value={condition} onChange={(e) => setCondition(e.target.value)} style={{ width: "auto" }}>
          <option>All</option>
          {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <button
          onClick={() => setSortByDistance((s) => !s)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm"
          style={{ border: `1px solid ${C.line}`, color: sortByDistance ? C.forest : C.inkSoft, backgroundColor: sortByDistance ? C.forestSoft : "transparent" }}
        >
          <MapPin size={13} /> Nearest first
        </button>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={Filter} title="No donations match" sub="Try clearing a filter or checking back later." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ donation, distance }) => (
            <DonationBrowseCard key={donation.id} donation={donation} distance={distance} matched={false} onRequest={() => onRequest(donation)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestFormModal({ donation, onClose, onSubmit }) {
  const [qty, setQty] = useState(Math.min(donation.availableQuantity, 5));
  const invalid = !qty || qty < 1 || qty > donation.availableQuantity;
  return (
    <Modal title={`Request "${donation.itemName}"`} onClose={onClose}>
      <p className="text-sm mb-4" style={{ color: C.inkSoft }}>{donation.availableQuantity} available in {donation.city}. Enter how many you need — the donor will review and accept or decline.</p>
      <Field label="Quantity requested" hint={`Maximum ${donation.availableQuantity}`}>
        <TextInput type="number" min="1" max={donation.availableQuantity} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
      </Field>
      {invalid && <p className="text-sm mb-3" style={{ color: C.rust }}>Enter a quantity between 1 and {donation.availableQuantity}.</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={invalid} icon={ArrowRight} onClick={() => onSubmit(qty)}>Send request</Btn>
      </div>
    </Modal>
  );
}

function NgoRequestsList({ requests, donationsById, usersById, onCancel }) {
  if (requests.length === 0) return <EmptyState icon={Inbox} title="No requests sent yet" sub="Request a donation from the Recommended or Browse tab to see it tracked here." />;
  const sorted = [...requests].sort((a, b) => b.requestedAt - a.requestedAt);
  return (
    <div className="space-y-3">
      {sorted.map((r) => {
        const donation = donationsById[r.donationId];
        const donor = donation ? usersById[donation.donorId] : null;
        return (
          <div key={r.id} className="rounded-lg p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}` }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium" style={{ color: C.ink }}>{r.requestedQuantity} × {donation?.itemName || "Removed donation"}</p>
                <p className="text-xs mt-1" style={{ color: C.inkSoft }}>From {donor?.name || "a donor"} in {donation?.city || "—"} · requested {fmtDate(r.requestedAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={r.status} />
                {r.status === "PENDING" && <Btn size="sm" variant="danger" icon={X} onClick={() => onCancel(r.id)}>Cancel</Btn>}
              </div>
            </div>
            {r.status !== "PENDING" && r.status !== "REJECTED" && r.status !== "CANCELLED" && (
              <div className="flex items-center gap-1 mt-3 pt-3" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
                {REQUEST_FLOW.map((s, i) => {
                  const currentIdx = REQUEST_FLOW.indexOf(r.status);
                  const done = i <= currentIdx;
                  return (
                    <React.Fragment key={s}>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={done ? { backgroundColor: C.forestSoft, color: C.forest } : { backgroundColor: C.lineSoft, color: C.inkSoft }}>
                        {STATUS_META[s].label}
                      </span>
                      {i < REQUEST_FLOW.length - 1 && <ChevronRight size={12} color={C.inkSoft} />}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================================
   ADMIN DASHBOARD
   ========================================================================= */
function AdminDashboard({ users, donations, requests, donationsById, usersById, onVerify, onRemoveDonation }) {
  const [tab, setTab] = useState("overview");

  const donors = users.filter((u) => u.role === "donor");
  const ngos = users.filter((u) => u.role === "ngo");
  const verifiedNgos = ngos.filter((n) => n.ngoProfile?.verified).length;
  const activeDonations = donations.filter((d) => d.status === "AVAILABLE").length;
  const completedRequests = requests.filter((r) => r.status === "COMPLETED").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="serif" style={{ fontSize: 26, color: C.ink }}>Platform overview</h1>
        <p className="text-sm mt-1" style={{ color: C.inkSoft }}>Monitor users, moderate donations, and verify NGOs.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Donors" value={donors.length} icon={User} />
        <StatCard label="NGOs verified" value={`${verifiedNgos}/${ngos.length}`} icon={ShieldCheck} />
        <StatCard label="Active donations" value={activeDonations} icon={Package} />
        <StatCard label="Completed handoffs" value={completedRequests} icon={CheckCircle2} />
      </div>

      <Tabs
        active={tab} onChange={setTab}
        tabs={[
          { key: "overview", label: "Users", icon: Users },
          { key: "donations", label: "Donations", icon: Package, count: donations.length },
          { key: "requests", label: "Requests", icon: ClipboardList, count: requests.length },
        ]}
      />

      {tab === "overview" && (
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.lineSoft}`, backgroundColor: C.surface }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: C.paper, color: C.inkSoft }}>
                {["Name", "Role", "Email", "City", "Status", "Joined", ""].map((h) => (
                  <th key={h} className="text-left font-medium px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: `1px solid ${C.lineSoft}` }}>
                  <td className="px-4 py-2.5" style={{ color: C.ink }}>{u.ngoProfile?.ngoName || u.name}</td>
                  <td className="px-4 py-2.5 capitalize" style={{ color: C.inkSoft }}>{u.role}</td>
                  <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{u.email}</td>
                  <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{u.ngoProfile?.city || u.city || "—"}</td>
                  <td className="px-4 py-2.5">
                    {u.role === "ngo" ? (
                      u.ngoProfile?.verified ? (
                        <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: C.forestSoft, color: C.forest }}><BadgeCheck size={11} /> Verified</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: C.goldSoft, color: C.gold }}><BadgeX size={11} /> Pending</span>
                      )
                    ) : (
                      <span style={{ color: C.inkSoft }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    {u.role === "ngo" && (
                      <Btn size="sm" variant="ghost" onClick={() => onVerify(u.id, !u.ngoProfile?.verified)}>
                        {u.ngoProfile?.verified ? "Unverify" : "Verify"}
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "donations" && (
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.lineSoft}`, backgroundColor: C.surface }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: C.paper, color: C.inkSoft }}>
                {["Item", "Donor", "Qty", "City", "Status", "Posted", ""].map((h) => (
                  <th key={h} className="text-left font-medium px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.id} style={{ borderTop: `1px solid ${C.lineSoft}` }}>
                  <td className="px-4 py-2.5" style={{ color: C.ink }}>{d.itemName}</td>
                  <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{usersById[d.donorId]?.name || "—"}</td>
                  <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{d.availableQuantity}/{d.quantity}</td>
                  <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{d.city}</td>
                  <td className="px-4 py-2.5"><StatusPill status={d.status === "AVAILABLE" ? "ACCEPTED" : d.status === "CLOSED" ? "COMPLETED" : "REJECTED"} /></td>
                  <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{fmtDate(d.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    {d.status !== "REMOVED" && (
                      <Btn size="sm" variant="danger" icon={Trash2} onClick={() => onRemoveDonation(d.id)}>Remove</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "requests" && (
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.lineSoft}`, backgroundColor: C.surface }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: C.paper, color: C.inkSoft }}>
                {["Donation", "NGO", "Qty", "Status", "Requested"].map((h) => (
                  <th key={h} className="text-left font-medium px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.lineSoft}` }}>
                  <td className="px-4 py-2.5" style={{ color: C.ink }}>{donationsById[r.donationId]?.itemName || "—"}</td>
                  <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{usersById[r.ngoId]?.ngoProfile?.ngoName || "—"}</td>
                  <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{r.requestedQuantity}</td>
                  <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{fmtDate(r.requestedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
