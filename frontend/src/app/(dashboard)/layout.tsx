import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background relative selection:bg-primary/30 selection:text-primary">
      <Sidebar />
      <div className="flex-1 ml-[280px] flex flex-col min-h-screen relative z-10">
        <TopNav />
        <main className="flex-1 pt-16 flex flex-col h-full relative">
          {children}
        </main>
      </div>
    </div>
  );
}
