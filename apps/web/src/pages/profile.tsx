import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonalTab, SecurityTab, SubscriptionTab } from "@/components/profileTabs";
import { useDailify } from "@/components/dailifyContext";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { invoices, permissions, paymentDetails } = useDailify();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "personal";

  const setActiveTab = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", value);
    setSearchParams(newParams);
  };

  return (
    <main className="w-full h-full px-[clamp(1rem,5vw,6rem)] flex flex-col">
      <AppHeader />

      <div className="w-full flex flex-col justify-center py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
          <h1 className="text-2xl font-bold">Profile</h1>
        </div>

        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-6 w-full bg-background">
            <TabsTrigger value="personal" className="border-0 cursor-pointer">
              Pessoal
            </TabsTrigger>
            <TabsTrigger value="security" className="border-0 cursor-pointer">
              Segurança
            </TabsTrigger>
            <TabsTrigger value="subscription" className="border-0 cursor-pointer">
              Assinatura
            </TabsTrigger>
            <TabsTrigger value="notifications" className="border-0 cursor-pointer">
              Notificações
            </TabsTrigger>
            <TabsTrigger value="devices" className="hidden md:block border-0 cursor-pointer">
              Dispositivos
            </TabsTrigger>
            <TabsTrigger value="activity" className="hidden md:block border-0 cursor-pointer">
              Atividade
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <PersonalTab />
          </TabsContent>

          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>

          <TabsContent value="subscription" className="space-y-6">
            {permissions && paymentDetails && invoices && (
              <SubscriptionTab
                invoices={invoices}
                paymentDetails={paymentDetails}
                permissions={permissions}
              />
            )}
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Manage how you get notifications about your tasks.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Notification settings will be implemented soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security"></TabsContent>

          <TabsContent value="security"></TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
