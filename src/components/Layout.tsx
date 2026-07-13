import React, { useState } from "react";
import { FileText, Menu, Settings2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useReportWorkspace } from "@/features/workspace/ReportWorkspaceContext";

interface LayoutProps {
  children: React.ReactNode;
}

type NavigationItem = {
  label: string;
  active: boolean;
  onClick: () => void;
  emphasized?: boolean;
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    environmentLabel,
    hasReport,
    openProtectedRoute,
    reportReference,
  } = useReportWorkspace();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const path = location.pathname;
  const onUploadRoute = path === "/" || path === "/upload";
  const onAcquireRoute = path === "/acquire";
  const onReportRoute = path === "/report";
  const onDisputeRoute = path === "/dispute";
  const onSettingsRoute = path === "/settings";

  const primaryItems: NavigationItem[] = [
    {
      label: "Dashboard",
      active: onUploadRoute,
      onClick: () => navigate("/upload"),
    },
    {
      label: "Reports    [+]",
      active: onReportRoute || onDisputeRoute,
      emphasized: true,
      onClick: () => {
        if (hasReport) {
          openProtectedRoute("report");
          return;
        }
        navigate("/upload");
      },
    },
  ];

  const workflowItems: NavigationItem[] = [
    {
      label: "Upload PDF",
      active: onUploadRoute,
      onClick: () => navigate("/upload"),
    },
    {
      label: "Get Reports",
      active: onAcquireRoute,
      onClick: () => navigate("/acquire"),
    },
    {
      label: "> Report View",
      active: onReportRoute,
      emphasized: true,
      onClick: () => openProtectedRoute("report"),
    },
    {
      label: "Dispute Letter",
      active: onDisputeRoute,
      onClick: () => openProtectedRoute("dispute"),
    },
    {
      label: "Settings",
      active: onSettingsRoute,
      onClick: () => navigate("/settings"),
    },
  ];

  const renderNavigation = (mobile = false) => (
    <div className={mobile ? "space-y-6" : "flex h-full flex-col"}>
      <div className="logo">
        <FileText className="mt-1 h-6 w-6 shrink-0" strokeWidth={2} />
        <span>
          Credit
          <br />
          Clarifier
        </span>
      </div>

      <hr className="divider-dashed" />

      <div className="nav-group">
        {primaryItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={cn("nav-item text-left", item.active && "active", item.emphasized && "font-semibold")}
            onClick={() => {
              item.onClick();
              setIsMobileNavOpen(false);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <hr className="divider-dashed" />

      <div className="nav-group">
        {workflowItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={cn("nav-item text-left", item.active && "active", item.emphasized && "font-semibold")}
            onClick={() => {
              item.onClick();
              setIsMobileNavOpen(false);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={cn("sidebar-meta", mobile ? "pt-6" : "mt-auto")}>
        Currently viewing:
        <br />
        Ref: {reportReference}
        <br />
        Env: {environmentLabel}
      </div>
    </div>
  );

  return (
    <div className="dossier-shell">
      <div className="dossier-frame">
        <aside className="sidebar hidden lg:flex">{renderNavigation()}</aside>

        <div className="content">
          <header className="dossier-mobile-bar lg:hidden">
            <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="dossier-button">
                  <Menu className="h-4 w-4" />
                  Menu
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[320px] border-black bg-[#f7f4ee] p-8">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                {renderNavigation(true)}
              </SheetContent>
            </Sheet>

            <div className="font-display text-[1.5rem] leading-none tracking-[-0.06em]">
              CreditClarifier
            </div>

            <Button type="button" variant="outline" className="dossier-button" onClick={() => navigate("/settings")}>
              <Settings2 className="h-4 w-4" />
              Settings
            </Button>
          </header>

          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
