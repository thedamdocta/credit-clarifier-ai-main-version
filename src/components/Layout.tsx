
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Home, Settings, Webhook } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center">
          <Link to="/" className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">CreditClarifier</span>
          </Link>
          
          <div className="flex flex-1 items-center justify-end space-x-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>
      
      <div className="container py-6">
        <Tabs defaultValue={path} className="w-full mb-6">
          <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
            <TabsTrigger value="/" asChild>
              <Link to="/" className="flex items-center">
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </TabsTrigger>
            <TabsTrigger value="/reports" asChild>
              <Link to="/reports" className="flex items-center">
                <FileText className="mr-2 h-4 w-4" />
                Reports
              </Link>
            </TabsTrigger>
            <TabsTrigger value="/webhooks" asChild>
              <Link to="/webhooks" className="flex items-center">
                <Webhook className="mr-2 h-4 w-4" />
                Webhooks
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {children}
      </div>
      
      <footer className="border-t py-4">
        <div className="container text-center text-sm text-muted-foreground">
          CreditClarifier AI &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
};

export default Layout;
