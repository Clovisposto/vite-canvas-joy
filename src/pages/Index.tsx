import { Youtube, Bell, Users, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo/Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-500/30 transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <Youtube className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center animate-pulse">
              <Play className="w-3 h-3 text-primary-foreground fill-current" />
            </div>
          </div>
        </div>

        {/* Welcome Text */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Bem-vindo ao{" "}
            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              Meu Canal
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
            Descubra conteúdos incríveis, tutoriais exclusivos e muito mais. 
            Inscreva-se e faça parte da nossa comunidade!
          </p>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 py-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground">
              <Users className="w-5 h-5 text-primary" />
              <span>10K+</span>
            </div>
            <p className="text-sm text-muted-foreground">Inscritos</p>
          </div>
          <div className="h-12 w-px bg-border" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground">
              <Play className="w-5 h-5 text-primary" />
              <span>500+</span>
            </div>
            <p className="text-sm text-muted-foreground">Vídeos</p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25 gap-2 px-8"
          >
            <Bell className="w-5 h-5" />
            Inscreva-se Agora
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            className="gap-2"
          >
            <Play className="w-5 h-5" />
            Ver Vídeos
          </Button>
        </div>

        {/* Footer text */}
        <p className="text-sm text-muted-foreground pt-4">
          ✨ Novos vídeos toda semana
        </p>
      </div>
    </div>
  );
};

export default Index;
