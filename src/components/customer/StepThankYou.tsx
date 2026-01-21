import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Heart, Zap, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import logoGP from "@/assets/logo-gp.png";

interface StepThankYouProps {
  postoName: string;
  onAutoReset?: () => void;
}

// Componente para partículas flutuantes no fundo
const FloatingParticle = ({ delay, x, size }: { delay: number; x: number; size: number }) => (
  <motion.div
    className="absolute rounded-full bg-white/10"
    style={{ width: size, height: size, left: `${x}%` }}
    initial={{ y: "100vh", opacity: 0 }}
    animate={{ 
      y: "-20vh", 
      opacity: [0, 0.6, 0.6, 0] 
    }}
    transition={{
      duration: 8,
      delay,
      repeat: Infinity,
      ease: "linear"
    }}
  />
);

// Componente para anéis de expansão ao redor do coração - agora em vermelho
const BurstRing = ({ delay, scale = 2.5 }: { delay: number; scale?: number }) => (
  <motion.div
    className="absolute inset-0 rounded-full border-2 border-[#ef0101]/40"
    initial={{ scale: 0.8, opacity: 0.9 }}
    animate={{ scale, opacity: 0 }}
    transition={{
      duration: 2.5,
      delay,
      repeat: Infinity,
      ease: "easeOut"
    }}
  />
);

export default function StepThankYou({ postoName, onAutoReset }: StepThankYouProps) {
  // Auto-fechar navegador após 10 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      
      if (isAndroid) {
        // Android: Intent para ir à tela inicial
        window.location.href = 'intent://launcher#Intent;action=android.intent.action.MAIN;category=android.intent.category.HOME;end';
      } else if (isIOS) {
        // iOS: Tentar fechar, fallback para about:blank
        window.close();
        setTimeout(() => {
          window.location.href = 'about:blank';
        }, 300);
      } else {
        // Desktop/outros: Tentar fechar
        window.close();
        setTimeout(() => {
          try {
            window.location.href = 'about:blank';
          } catch {
            // Navegador bloqueou - fallback para onAutoReset
            onAutoReset?.();
          }
        }, 500);
      }
    }, 10000);
    
    return () => clearTimeout(timer);
  }, [onAutoReset]);

  // Partículas de fundo
  const particles = [
    { delay: 0, x: 15, size: 4 },
    { delay: 1.5, x: 35, size: 6 },
    { delay: 3, x: 55, size: 5 },
    { delay: 4.5, x: 75, size: 4 },
    { delay: 2, x: 85, size: 5 },
    { delay: 0.5, x: 25, size: 3 },
    { delay: 2.5, x: 65, size: 4 },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" as const }
    }
  };

  return (
    <div className="min-h-screen-ios bg-primary flex flex-col overflow-hidden safe-bottom relative">
      {/* Partículas flutuantes de fundo */}
      {particles.map((p, i) => (
        <FloatingParticle key={i} delay={p.delay} x={p.x} size={p.size} />
      ))}

      {/* Header - Logo GP Premium */}
      <div className="px-6 pt-12 pb-6 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Container premium para a logo */}
          <div className="relative inline-block">
            {/* Efeito de glow pulsante externo */}
            <motion.div
              className="absolute inset-0 rounded-2xl bg-white/15 blur-2xl scale-150"
              animate={{ 
                opacity: [0.2, 0.4, 0.2],
                scale: [1.4, 1.6, 1.4]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Container com backdrop e borda sutil */}
            <motion.div 
              className="relative z-10 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Shimmer effect */}
              <motion.div className="absolute inset-0 rounded-2xl overflow-hidden">
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                  animate={{ x: ["-150%", "150%"] }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity, 
                    repeatDelay: 3,
                    ease: "easeInOut"
                  }}
                />
              </motion.div>
              
              {/* Logo */}
              <img 
                src={logoGP} 
                alt="Grupo Pará" 
                className="w-20 h-20 object-contain relative z-10"
              />
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Card Principal */}
      <div className="flex-1 px-6 pb-8 flex items-start justify-center relative z-10">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 100 }}
          className="w-full max-w-md"
        >
          <Card className="bg-card p-8 rounded-2xl shadow-xl border-0 text-center">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Nome do Posto - Primeiro elemento, grande e em destaque */}
              <motion.div variants={itemVariants} className="mb-6">
                <motion.p 
                  className="text-2xl font-bold text-primary"
                  animate={{ 
                    textShadow: [
                      "0 0 0px rgba(30,15,131,0)",
                      "0 0 20px rgba(30,15,131,0.4)",
                      "0 0 0px rgba(30,15,131,0)"
                    ]
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  {postoName}
                </motion.p>
              </motion.div>

              {/* Ícone Coração com efeitos - Vermelho Vivo */}
              <motion.div 
                variants={itemVariants}
                className="mb-6 flex items-center justify-center"
              >
                <div className="relative">
                  {/* Burst rings - 4 anéis com delays variados */}
                  <BurstRing delay={0} scale={2} />
                  <BurstRing delay={0.5} scale={2.5} />
                  <BurstRing delay={1} scale={3} />
                  <BurstRing delay={1.5} scale={2.2} />
                  
                  {/* Glow vermelho intenso atrás do coração */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-[#ef0101]/30 blur-lg"
                    animate={{ 
                      scale: [1, 1.4, 1],
                      opacity: [0.4, 0.7, 0.4]
                    }}
                    transition={{
                      duration: 1.3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  
                  {/* Coração vermelho vivo com pulso */}
                  <motion.div 
                    className="relative z-10 inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#ef0101]/10"
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 2, -2, 0]
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Heart className="w-8 h-8 text-[#ef0101] fill-[#ef0101]" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Título */}
              <motion.h1 
                variants={itemVariants}
                className="text-xl font-bold text-primary mb-4"
              >
                Obrigado pela preferência
              </motion.h1>

              {/* Mensagens com staggered animation */}
              <motion.p 
                variants={itemVariants}
                className="text-muted-foreground text-sm leading-relaxed mb-2"
              >
                Sua participação foi registrada com sucesso.
              </motion.p>
              <motion.p 
                variants={itemVariants}
                className="text-muted-foreground text-sm leading-relaxed"
              >
                Após a realização do sorteio, entraremos em contato pelos dados informados.
              </motion.p>

              {/* Separador animado */}
              <motion.div 
                className="mt-6 border-t border-border/40"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1, duration: 0.6, ease: "easeOut" }}
                style={{ originX: 0.5 }}
              />

              {/* Seção Volte Sempre e Promoções Relâmpago */}
              <motion.div 
                className="mt-6 space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.5, ease: "easeOut" }}
              >
                {/* Volte Sempre */}
                <motion.h2 
                  className="text-xl font-bold text-primary"
                  animate={{ 
                    scale: [1, 1.02, 1],
                    textShadow: [
                      "0 0 0px rgba(30,15,131,0)",
                      "0 0 12px rgba(30,15,131,0.3)",
                      "0 0 0px rgba(30,15,131,0)"
                    ]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  Volte sempre!
                </motion.h2>
                
                {/* Texto sobre WhatsApp */}
                <motion.p 
                  className="text-sm text-muted-foreground"
                  initial={{ opacity: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ delay: 1.4, duration: 0.5 }}
                >
                  Acompanhe pelo{" "}
                  <span className="font-bold text-[#25D366]">WhatsApp</span>{" "}
                  nossas promoções
                </motion.p>
                
                {/* Card Promoções Relâmpago - Design Premium Dourado */}
                <motion.div 
                  className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-yellow-50 rounded-2xl p-6 border-2 border-amber-400/50"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.6, duration: 0.4, type: "spring", stiffness: 120 }}
                  style={{ boxShadow: "0 8px 32px rgba(251,191,36,0.3), 0 0 0 1px rgba(218,165,32,0.2), inset 0 1px 0 rgba(255,255,255,0.8)" }}
                >
                  {/* Shimmer effect dourado premium */}
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/60 to-transparent skew-x-12"
                    animate={{ x: ["-150%", "150%"] }}
                    transition={{ 
                      duration: 2.5, 
                      repeat: Infinity, 
                      repeatDelay: 2,
                      ease: "easeInOut"
                    }}
                  />
                  
                  {/* Borda pulsante dourada */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-amber-500/60"
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  
                  {/* Efeito de brilho no canto */}
                  <motion.div
                    className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-yellow-300/40 to-transparent rounded-full blur-2xl"
                    animate={{ 
                      opacity: [0.3, 0.6, 0.3],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  
                  {/* Header com raios dourados */}
                  <div className="relative z-10 flex items-center justify-center gap-2 mb-4">
                    <motion.div
                      animate={{ 
                        scale: [1, 1.3, 1], 
                        opacity: [0.8, 1, 0.8],
                        rotate: [0, -10, 0]
                      }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Zap className="w-7 h-7 text-amber-500 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                    </motion.div>
                    <motion.span 
                      className="text-xl font-black bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 bg-clip-text text-transparent tracking-wide"
                      animate={{ 
                        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                      style={{ backgroundSize: "200% 200%" }}
                    >
                      PROMOÇÕES RELÂMPAGO
                    </motion.span>
                    <motion.div
                      animate={{ 
                        scale: [1, 1.3, 1], 
                        opacity: [0.8, 1, 0.8],
                        rotate: [0, 10, 0]
                      }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                    >
                      <Zap className="w-7 h-7 text-amber-500 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                    </motion.div>
                  </div>
                  
                  {/* Valores em destaque com dourado */}
                  <motion.p 
                    className="relative z-10 text-base text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.8, duration: 0.4 }}
                  >
                    Descontos de{" "}
                    <motion.span 
                      className="font-black text-xl bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent"
                      animate={{ 
                        textShadow: [
                          "0 0 0px rgba(251,191,36,0)",
                          "0 0 20px rgba(251,191,36,0.6)",
                          "0 0 0px rgba(251,191,36,0)"
                        ]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      R$0,05
                    </motion.span>{" "}
                    a{" "}
                    <motion.span 
                      className="font-black text-xl bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent"
                      animate={{ 
                        textShadow: [
                          "0 0 0px rgba(251,191,36,0)",
                          "0 0 20px rgba(251,191,36,0.6)",
                          "0 0 0px rgba(251,191,36,0)"
                        ]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                    >
                      R$0,50
                    </motion.span>{" "}
                    por litro
                  </motion.p>
                  
                  {/* Aviso de notificação com ícone vibrando */}
                  <motion.div 
                    className="relative z-10 flex items-center justify-center gap-2 mt-4 pt-3 border-t border-amber-300/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 0.4 }}
                  >
                    <motion.div
                      animate={{ 
                        x: [0, -2, 2, -2, 2, 0], 
                        rotate: [0, -5, 5, -5, 5, 0] 
                      }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <Smartphone className="w-5 h-5 text-[#25D366]" />
                    </motion.div>
                    <span className="text-sm text-muted-foreground font-medium">
                      Fique atento às notificações!
                    </span>
                  </motion.div>
                </motion.div>
              </motion.div>
            </motion.div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
