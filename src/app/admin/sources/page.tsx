"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ExternalLink, Search, Globe, FileSpreadsheet, MapPin, ChevronDown, ChevronUp, Info } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── DATA ────────────────────────────────────────────────────────────────────

const NATIONAL_SOURCES = [
  {
    name: "USDA FNS Area Eligibility Mapper",
    description: "Official USDA interactive map showing census tract eligibility for CACFP. Use this to verify area eligibility before or after importing centers — paste the address of any center to check its FRP percentage and eligibility tier.",
    url: "https://www.fns.usda.gov/cn/area-eligibility",
    type: "mapper",
    what: "Area eligibility by census tract (not a center list)",
  },
  {
    name: "FRAC CACFP Mapper",
    description: "Food Research & Action Center's CACFP mapper — a cleaner interface over the same eligibility data. Useful for quickly checking whether a neighborhood qualifies before prospecting.",
    url: "https://frac.org/cacfp-mapper",
    type: "mapper",
    what: "Area eligibility visualization tool",
  },
  {
    name: "National CACFP Association — Find a Sponsor",
    description: "Directory of CACFP sponsoring organizations by state. Use this to identify which sponsors are already active in an area — centers listed under a sponsor are already enrolled and lower-priority for prospecting.",
    url: "https://info.cacfp.org/sponsor",
    type: "directory",
    what: "Active sponsor organizations by state",
  },
  {
    name: "USDA CACFP National Disqualified List",
    description: "Before adding a center to your database, check it against the NDL. Institutions on this list are disqualified from CACFP participation and should be flagged or excluded.",
    url: "https://snp.fns.usda.gov/ndlweb/Welcome.action",
    type: "compliance",
    what: "Disqualified institutions — cross-reference before outreach",
  },
  {
    name: "HHS Childcare.gov — State Resources",
    description: "Federal hub linking to each state's childcare licensing agency. Good starting point for states not listed below, or to verify you have the current state agency URL.",
    url: "https://childcare.gov/state-resources",
    type: "directory",
    what: "State-by-state licensing agency links",
  },
  {
    name: "HHS Child Care Licensing Regulations Database",
    description: "National database of child care licensing regulations by state, facility type, and topic. Useful for understanding what types of centers are licensed in a given state before prospecting.",
    url: "https://licensingregulations.acf.hhs.gov/",
    type: "reference",
    what: "Licensing regulation data — not a center list",
  },
  {
    name: "Data.gov — Childcare Datasets",
    description: "Federal open data portal with state-published childcare datasets. Coverage is inconsistent — some states publish full licensed facility lists here, others do not. Search 'child care [state name]' to check.",
    url: "https://catalog.data.gov/dataset/?tags=child-care",
    type: "download",
    what: "Some states publish downloadable facility lists here",
  },
];

type DownloadType = "csv" | "search" | "pdf" | "request";

interface StateSource {
  state: string;
  abbr: string;
  cacfpAgency: string;
  cacfpUrl: string;
  licensingData?: { label: string; url: string; type: DownloadType; notes?: string };
  notes?: string;
}

const STATE_SOURCES: StateSource[] = [
  { state: "Alabama", abbr: "AL", cacfpAgency: "Alabama Achieves", cacfpUrl: "https://www.alabamaachieves.org/child-nutrition-programs/cacfp-sfsp/", notes: "Contact state agency directly to request facility list." },
  { state: "Alaska", abbr: "AK", cacfpAgency: "Alaska Dept. of Education", cacfpUrl: "https://education.alaska.gov/cnp/cacfp" },
  { state: "Arizona", abbr: "AZ", cacfpAgency: "Arizona Dept. of Education", cacfpUrl: "https://www.azed.gov/hns/cacfp/" },
  { state: "Arkansas", abbr: "AR", cacfpAgency: "Arkansas Dept. of Education", cacfpUrl: "https://snp.ade.arkansas.gov/WelcomeSNPM.aspx" },
  { state: "California", abbr: "CA", cacfpAgency: "CA Dept. of Social Services", cacfpUrl: "https://www.cdss.ca.gov/cacfp", licensingData: { label: "CA Licensed Childcare Search", url: "https://www.ccld.dss.ca.gov/carefacilitysearch/", type: "search", notes: "Searchable database — no bulk download. Contact CDSS for a data extract." } },
  { state: "Colorado", abbr: "CO", cacfpAgency: "CO Dept. of Public Health & Environment", cacfpUrl: "https://cdphe.colorado.gov/CACFP" },
  { state: "Connecticut", abbr: "CT", cacfpAgency: "CT State Dept. of Education", cacfpUrl: "https://portal.ct.gov/SDE/Nutrition/Child-and-Adult-Care-Food-Program", licensingData: { label: "CT OEC Childcare Data", url: "https://data.ct.gov/Health-and-Human-Services/Child-Care-Youth-Camp-Licensing-Database/h8mr-dn95", type: "csv", notes: "Direct CSV download of licensed providers from CT Open Data." } },
  { state: "Delaware", abbr: "DE", cacfpAgency: "Delaware Dept. of Education", cacfpUrl: "https://education.delaware.gov/students/student_services/cacfp/" },
  { state: "District of Columbia", abbr: "DC", cacfpAgency: "DC Office of State Superintendent", cacfpUrl: "https://osse.dc.gov/service/child-and-adult-care-food-program-cacfp" },
  { state: "Florida", abbr: "FL", cacfpAgency: "FL Dept. of Health", cacfpUrl: "http://www.floridahealth.gov/programs-and-services/childrens-health/child-care-food-program/index.html", licensingData: { label: "FL Childcare Facility Search", url: "https://www.myflfamilies.com/service-programs/child-care/facility-search", type: "search", notes: "Online lookup only. Request bulk data via Florida DCF public records request." } },
  { state: "Georgia", abbr: "GA", cacfpAgency: "GA Dept. of Early Care and Learning", cacfpUrl: "https://www.decal.ga.gov/CACFP/Applicant.aspx", licensingData: { label: "DECAL Childcare Search", url: "https://www.decal.ga.gov/BFTS/Search.aspx", type: "search", notes: "Search DECAL's licensed provider database. No bulk export — submit an Open Records request for a full extract." } },
  { state: "Hawaii", abbr: "HI", cacfpAgency: "Hawaii Child Nutrition Programs", cacfpUrl: "http://hcnp.hawaii.gov/overview/cacfp/" },
  { state: "Idaho", abbr: "ID", cacfpAgency: "Idaho State Dept. of Education", cacfpUrl: "https://www.sde.idaho.gov/cnp/cacfp/" },
  { state: "Illinois", abbr: "IL", cacfpAgency: "Illinois State Board of Education", cacfpUrl: "https://www.isbe.net/Pages/Child-Adult-Care-Food-Program.aspx", licensingData: { label: "IL DCFS Licensed Childcare", url: "https://www.dhs.state.il.us/page.aspx?item=33226", type: "search", notes: "DCFS maintains licensed facility list. Request bulk data through IDCFS." } },
  { state: "Indiana", abbr: "IN", cacfpAgency: "Indiana Dept. of Education", cacfpUrl: "https://www.in.gov/doe/nutrition/child-and-adult-care-food-program/" },
  { state: "Iowa", abbr: "IA", cacfpAgency: "Iowa Dept. of Education", cacfpUrl: "https://educateiowa.gov/pk-12/nutrition-programs/child-and-adult-care-food-program" },
  { state: "Kansas", abbr: "KS", cacfpAgency: "Kansas State Dept. of Education", cacfpUrl: "https://cnw.ksde.org/" },
  { state: "Kentucky", abbr: "KY", cacfpAgency: "Kentucky Dept. of Education", cacfpUrl: "https://education.ky.gov/federal/SCN/Pages/CACFPHomepage.aspx" },
  { state: "Louisiana", abbr: "LA", cacfpAgency: "Louisiana Believes", cacfpUrl: "https://www.louisianabelieves.com/schools/public-schools/nutrition" },
  { state: "Maine", abbr: "ME", cacfpAgency: "Maine Dept. of Education", cacfpUrl: "https://www.maine.gov/doe/schools/nutrition/programs/cacfplanding" },
  { state: "Maryland", abbr: "MD", cacfpAgency: "Maryland Public Schools", cacfpUrl: "http://marylandpublicschools.org/programs/SchoolandCommunityNutrition/Pages/Programs/CACFP.aspx" },
  { state: "Massachusetts", abbr: "MA", cacfpAgency: "MA Dept. of Elementary & Secondary Ed.", cacfpUrl: "https://www.doe.mass.edu/cnp/nprograms/cacfp.html", licensingData: { label: "MA EEC Licensed Provider Search", url: "https://eec.state.ma.us/ChildCareSearch/Search.aspx", type: "search", notes: "Search EEC's licensed provider database. Request data export from MA EEC directly." } },
  { state: "Michigan", abbr: "MI", cacfpAgency: "Michigan Dept. of Education", cacfpUrl: "https://www.michigan.gov/mde/0,4615,7-140-66254_25656---,00.html" },
  { state: "Minnesota", abbr: "MN", cacfpAgency: "Minnesota Dept. of Education", cacfpUrl: "https://education.mn.gov/MDE/dse/FNS/prog/CACFPFam/" },
  { state: "Mississippi", abbr: "MS", cacfpAgency: "Mississippi Dept. of Education", cacfpUrl: "https://mdek12.org/childnutrition/child-and-adult-care-food-program-cacfp/" },
  { state: "Missouri", abbr: "MO", cacfpAgency: "Missouri Dept. of Health", cacfpUrl: "https://health.mo.gov/living/wellness/nutrition/foodprograms/cacfp/index.php" },
  { state: "Montana", abbr: "MT", cacfpAgency: "Montana DPHHS", cacfpUrl: "https://dphhs.mt.gov/ecfsd/childcare/cacfp/index" },
  { state: "Nebraska", abbr: "NE", cacfpAgency: "Nebraska Dept. of Education", cacfpUrl: "https://www.education.ne.gov/NS/CACFP/" },
  { state: "Nevada", abbr: "NV", cacfpAgency: "Nevada Dept. of Agriculture", cacfpUrl: "https://agri.nv.gov/Food/CACFP/" },
  { state: "New Hampshire", abbr: "NH", cacfpAgency: "NH Dept. of Education", cacfpUrl: "https://www.education.nh.gov/who-we-are/division-of-learner-support/bureau-of-student-wellness/office-of-nutritional-services/child-adult-care-food" },
  { state: "New Jersey", abbr: "NJ", cacfpAgency: "NJ Dept. of Agriculture", cacfpUrl: "https://www.nj.gov/agriculture/divisions/fn/childadult/food.html" },
  { state: "New Mexico", abbr: "NM", cacfpAgency: "NM ECECD", cacfpUrl: "https://www.nmececd.org/family-nutrition/" },
  { state: "New York", abbr: "NY", cacfpAgency: "NY State Dept. of Health", cacfpUrl: "https://www.health.ny.gov/prevention/nutrition/cacfp/", licensingData: { label: "NY Childcare Facility Lookup", url: "https://ocfs.ny.gov/programs/childcare/looking/", type: "search", notes: "OCFS maintains licensed provider database. Request bulk export from NY OCFS." } },
  { state: "North Carolina", abbr: "NC", cacfpAgency: "NC Dept. of Health & Human Services", cacfpUrl: "https://www.ncdhhs.gov/nccacfp", licensingData: { label: "NC DCDEE Childcare Search", url: "https://ncchildcaresearch.dhhs.nc.gov/search", type: "search", notes: "NC DCDEE publishes licensed facility data. Contact NCDHHS for bulk extract." } },
  { state: "North Dakota", abbr: "ND", cacfpAgency: "ND Dept. of Public Instruction", cacfpUrl: "https://www.nd.gov/dpi/districtsschools/child-nutrition-and-food-distribution/child-adult-care-food-program" },
  { state: "Ohio", abbr: "OH", cacfpAgency: "Ohio Dept. of Education", cacfpUrl: "http://education.ohio.gov/Topics/Student-Supports/Food-and-Nutrition/Child-and-Adult-Care-Food-Program-CACFP" },
  { state: "Oklahoma", abbr: "OK", cacfpAgency: "Oklahoma State Dept. of Education", cacfpUrl: "https://sde.ok.gov/child-nutrition-programs#CACFP" },
  { state: "Oregon", abbr: "OR", cacfpAgency: "Oregon Dept. of Education", cacfpUrl: "https://www.oregon.gov/ode/students-and-family/childnutrition/cacfp/Pages/Community%20Nutrition%20Programs.aspx" },
  { state: "Pennsylvania", abbr: "PA", cacfpAgency: "PA Dept. of Education", cacfpUrl: "https://www.education.pa.gov/Teachers%20-%20Administrators/Food-Nutrition/programs/Pages/default.aspx" },
  { state: "Rhode Island", abbr: "RI", cacfpAgency: "RI Dept. of Education", cacfpUrl: "https://www.ride.ri.gov/CNP/NutritionPrograms/ChildandAdultCareFoodProgram.aspx" },
  { state: "South Carolina", abbr: "SC", cacfpAgency: "SC DSS", cacfpUrl: "https://www.scchildcare.org/departments/child-and-adult-care-food-program.aspx" },
  { state: "South Dakota", abbr: "SD", cacfpAgency: "SD Dept. of Education", cacfpUrl: "https://doe.sd.gov/cans/cacfp.aspx" },
  { state: "Tennessee", abbr: "TN", cacfpAgency: "TN Dept. of Human Services", cacfpUrl: "https://www.tn.gov/humanservices/children/dhs-nutrition-programs/child-and-adult-care-food-program.html" },
  { state: "Texas", abbr: "TX", cacfpAgency: "TX Dept. of Agriculture (SquareMeals)", cacfpUrl: "https://squaremeals.org/Programs/ChildandAdultCareFoodProgram.aspx", licensingData: { label: "TX HHSC Licensed Childcare Data", url: "https://data.texas.gov/Social-Services/HHSC-CCL-Daycare-and-Residential-Operations-Data/bc5r-88dy", type: "csv", notes: "Direct CSV download from Texas Open Data Portal. Includes all HHSC-licensed daycare operations with address, capacity, and type." } },
  { state: "Utah", abbr: "UT", cacfpAgency: "Utah State Board of Education", cacfpUrl: "https://schools.utah.gov/cnp" },
  { state: "Vermont", abbr: "VT", cacfpAgency: "Vermont Agency of Education", cacfpUrl: "https://education.vermont.gov/student-support/nutrition/child-and-adult-care-food" },
  { state: "Virginia", abbr: "VA", cacfpAgency: "VA Dept. of Health", cacfpUrl: "https://www.vdh.virginia.gov/child-and-adult-care-food-program/" },
  { state: "Washington", abbr: "WA", cacfpAgency: "WA Office of Superintendent of Public Instruction", cacfpUrl: "https://www.k12.wa.us/policy-funding/child-nutrition/community-nutrition/child-and-adult-care-food-program", licensingData: { label: "WA DCYF Licensed Childcare", url: "https://data.wa.gov/Social-Services/DCYF-Licensed-Childcare-Provider/d3ah-gakb", type: "csv", notes: "Direct CSV download from WA Open Data. Active licensed childcare providers with address, capacity, and license type." } },
  { state: "West Virginia", abbr: "WV", cacfpAgency: "WV Dept. of Education", cacfpUrl: "https://wvde.us/child-nutrition/child-and-adult-care-food-program/" },
  { state: "Wisconsin", abbr: "WI", cacfpAgency: "WI Dept. of Public Instruction", cacfpUrl: "https://dpi.wi.gov/community-nutrition/cacfp" },
  { state: "Wyoming", abbr: "WY", cacfpAgency: "Wyoming Dept. of Education", cacfpUrl: "https://edu.wyoming.gov/beyond-the-classroom/nutrition/cacfp/" },
  { state: "Guam", abbr: "GU", cacfpAgency: "Guam Dept. of Education", cacfpUrl: "https://gdoe.net/District/Department/1-Child-Nutrition-Program" },
  { state: "Puerto Rico", abbr: "PR", cacfpAgency: "Puerto Rico Dept. of Education", cacfpUrl: "https://de.pr.gov/aesan/en/cacfp/" },
];

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  mapper:     { label: "Mapper",     color: "var(--color-blue)" },
  directory:  { label: "Directory",  color: "var(--color-navy)" },
  compliance: { label: "Compliance", color: "#B45309" },
  download:   { label: "Download",   color: "#166534" },
  reference:  { label: "Reference",  color: "var(--color-muted-text)" },
  csv:        { label: "CSV Download", color: "#166534" },
  search:     { label: "Search Only", color: "var(--color-blue)" },
  pdf:        { label: "PDF",        color: "#92400E" },
  request:    { label: "Request Required", color: "var(--color-muted-text)" },
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function DataSources() {
  const router = useRouter();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [stateSearch, setStateSearch] = useState("");
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/admin");
      else setIsAuthChecking(false);
    });
  }, [router]);

  const toggleState = (abbr: string) => {
    setExpandedStates((prev) => {
      const next = new Set(prev);
      next.has(abbr) ? next.delete(abbr) : next.add(abbr);
      return next;
    });
  };

  const filteredStates = STATE_SOURCES.filter(
    (s) =>
      s.state.toLowerCase().includes(stateSearch.toLowerCase()) ||
      s.abbr.toLowerCase().includes(stateSearch.toLowerCase())
  );

  if (isAuthChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-light-gray)" }}>
        <span className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--color-subtle-border)", borderTopColor: "var(--color-blue)" }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--color-light-gray)" }}>
      {/* Header */}
      <header style={{ background: "var(--color-navy)" }}>
        <div className="max-w-4xl mx-auto px-7 py-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold mb-1">
              <span style={{ color: "white" }}>Kid</span>
              <span style={{ color: "var(--color-muted-blue)" }}>Kare</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(225,241,249,0.12)", color: "var(--color-muted-blue)" }}>
                Admin
              </span>
            </div>
            <h1 className="text-xl font-extrabold" style={{ color: "white" }}>Data Sources</h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-muted-blue)" }}>
              Verified sources for CACFP prospecting data — national tools and all 50 state agencies
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/upload" className="text-xs font-semibold px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.1)", color: "white" }}>
              ← Upload
            </a>
            <a href="/" className="text-xs font-medium" style={{ color: "var(--color-muted-blue)" }}>
              Prospector
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-7 py-8 space-y-10">

        {/* How to use */}
        <div className="rounded-2xl p-5 flex gap-3"
          style={{ background: "var(--color-light-blue)", border: "1px solid var(--color-subtle-border)" }}>
          <Info size={18} className="shrink-0 mt-0.5" style={{ color: "var(--color-blue)" }} />
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-navy)" }}>How to use this page</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted-text)" }}>
              Find your target state below, download or request the licensed childcare facility list, then use the{" "}
              <a href="/admin/upload" style={{ color: "var(--color-blue)", fontWeight: 600 }}>Upload tool</a>{" "}
              to import it into your database. States marked <strong>CSV Download</strong> have direct download links.
              States marked <strong>Search Only</strong> require a public records request to get a bulk extract.
              Cross-reference new centers against the USDA National Disqualified List before outreach.
            </p>
          </div>
        </div>

        {/* National sources */}
        <section>
          <h2 className="text-base font-bold mb-4" style={{ color: "var(--color-navy)" }}>
            National Tools &amp; References
          </h2>
          <div className="space-y-3">
            {NATIONAL_SOURCES.map((source) => {
              const typeInfo = TYPE_LABELS[source.type];
              return (
                <div key={source.name} className="rounded-xl p-5"
                  style={{ background: "white", border: "1px solid var(--color-subtle-border)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: "var(--color-navy)" }}>
                          {source.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "var(--color-light-blue)", color: typeInfo.color }}>
                          {typeInfo.label}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--color-muted-text)" }}>
                        {source.description}
                      </p>
                      <p className="text-xs font-medium" style={{ color: "var(--color-ink-faint)" }}>
                        Contains: {source.what}
                      </p>
                    </div>
                    <a href={source.url} target="_blank" rel="noopener noreferrer"
                      className="btn-outline flex items-center gap-1.5 shrink-0">
                      <ExternalLink size={11} /> Open
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* State sources */}
        <section>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-base font-bold" style={{ color: "var(--color-navy)" }}>
              State Agency Sources
            </h2>
            <div className="relative w-52">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-ink-faint)" }} />
              <input
                type="text"
                className="input-field py-1.5 pl-8 text-xs"
                placeholder="Filter by state..."
                value={stateSearch}
                onChange={(e) => setStateSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            {filteredStates.map((s) => {
              const expanded = expandedStates.has(s.abbr);
              const hasDownload = !!s.licensingData;
              const dlType = s.licensingData ? TYPE_LABELS[s.licensingData.type] : null;

              return (
                <div key={s.abbr} className="rounded-xl overflow-hidden"
                  style={{ background: "white", border: "1px solid var(--color-subtle-border)" }}>
                  <button
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left"
                    onClick={() => toggleState(s.abbr)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold w-6 shrink-0" style={{ color: "var(--color-blue)" }}>
                        {s.abbr}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: "var(--color-navy)" }}>
                        {s.state}
                      </span>
                      {hasDownload && dlType && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline-flex"
                          style={{ background: "var(--color-light-blue)", color: dlType.color }}>
                          {dlType.label}
                        </span>
                      )}
                    </div>
                    {expanded
                      ? <ChevronUp size={14} style={{ color: "var(--color-ink-faint)" }} />
                      : <ChevronDown size={14} style={{ color: "var(--color-ink-faint)" }} />
                    }
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5 border-t space-y-4"
                      style={{ borderColor: "var(--color-subtle-border)" }}>

                      {/* CACFP State Agency */}
                      <div className="pt-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Globe size={12} style={{ color: "var(--color-blue)" }} />
                          <span className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: "var(--color-ink-faint)" }}>
                            CACFP State Agency
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm" style={{ color: "var(--color-navy)" }}>{s.cacfpAgency}</span>
                          <a href={s.cacfpUrl} target="_blank" rel="noopener noreferrer"
                            className="btn-outline flex items-center gap-1.5 shrink-0">
                            <ExternalLink size={11} /> Open
                          </a>
                        </div>
                        <p className="text-xs mt-1" style={{ color: "var(--color-ink-faint)" }}>
                          State agency that administers CACFP — contact here to inquire about current sponsor/participant lists.
                        </p>
                      </div>

                      {/* Licensing data source */}
                      {s.licensingData ? (
                        <div className="rounded-xl p-4"
                          style={{ background: "var(--color-light-blue)", border: "1px solid var(--color-subtle-border)" }}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <FileSpreadsheet size={12} style={{ color: "var(--color-blue)" }} />
                            <span className="text-xs font-semibold uppercase tracking-wider"
                              style={{ color: "var(--color-blue)" }}>
                              Licensed Facility Data
                            </span>
                            {dlType && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium ml-auto"
                                style={{ background: "white", color: dlType.color }}>
                                {dlType.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "var(--color-navy)" }}>
                                {s.licensingData.label}
                              </p>
                              {s.licensingData.notes && (
                                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--color-muted-text)" }}>
                                  {s.licensingData.notes}
                                </p>
                              )}
                            </div>
                            <a href={s.licensingData.url} target="_blank" rel="noopener noreferrer"
                              className="btn-primary flex items-center gap-1.5 shrink-0 py-1.5 text-xs">
                              <ExternalLink size={11} />
                              {s.licensingData.type === "csv" ? "Download" : "Open"}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl p-4"
                          style={{ background: "var(--color-light-gray)", border: "1px solid var(--color-subtle-border)" }}>
                          <div className="flex items-center gap-2">
                            <MapPin size={13} style={{ color: "var(--color-ink-faint)" }} />
                            <p className="text-xs" style={{ color: "var(--color-muted-text)" }}>
                              {s.notes || "No confirmed bulk download available for this state. Contact the state agency above to request a licensed facility list, or check the state's open data portal."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
