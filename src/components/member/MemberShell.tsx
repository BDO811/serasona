import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { Pause, Play, UserRound } from "lucide-react";
import { asset } from "@/lib/asset";
import "./member.css";

const MotionContext = createContext(true);
export const useMemberMotion = () => useContext(MotionContext);
export function MemberShell({ children, motionControl = false }: { children: ReactNode; motionControl?: boolean }) {
  const [moving, setMoving] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setMoving(!query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return <MotionContext.Provider value={moving}>
    <div className={`member ${moving ? "" : "member-still"}`}>
      <div className="member-window">
        <header className="member-header">
          <Link to="/dashboard" aria-label="Serasona dashboard"><img src={asset("brand/serasona-logo-member.svg")} alt="Serasona" width="170" height="40" /></Link>
          <nav aria-label="Your account navigation">
            {motionControl && <button className="motion-control" onClick={() => setMoving(!moving)} aria-label={moving ? "Pause animations" : "Play animations"}>{moving ? <Pause size={14} /> : <Play size={14} />}<span>Motion</span></button>}
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/account" className="account-link"><UserRound size={16} /><span>Account</span></NavLink>
          </nav>
        </header>
        {children}
        <footer className="member-footer"><span>Serasona · Your voice. Your perspective.</span><span>Wellness signals, not diagnoses.</span></footer>
      </div>
    </div>
  </MotionContext.Provider>;
}
