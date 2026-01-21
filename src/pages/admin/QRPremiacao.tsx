import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, List } from 'lucide-react';
import PremioForm from '@/components/admin/PremioForm';
import PremiosList from '@/components/admin/PremiosList';

export default function QRPremiacao() {
  const [activeTab, setActiveTab] = useState('criar');
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePremioCreated = () => {
    setRefreshKey(prev => prev + 1);
    setActiveTab('lista');
  };

  return (
    <AdminLayout title="QR Premiação">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Gestão de Prêmios via QR Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="criar" className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Criar Prêmio
              </TabsTrigger>
              <TabsTrigger value="lista" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                Lista de Prêmios
              </TabsTrigger>
            </TabsList>

            <TabsContent value="criar">
              <PremioForm onSuccess={handlePremioCreated} />
            </TabsContent>

            <TabsContent value="lista">
              <PremiosList key={refreshKey} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
