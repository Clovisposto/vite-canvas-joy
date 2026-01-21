import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fuel, Gift, Trophy, ArrowRight, Megaphone, Wrench, Store } from "lucide-react";
import { motion } from "framer-motion";

interface StepWelcomeProps {
  postoName: string;
  onNext: () => void;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

const iconItem = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1 }
};

export default function StepWelcome({ postoName, onNext }: StepWelcomeProps) {
  return (
    <div className="min-h-screen-ios bg-gradient-to-b from-primary to-primary/90 flex flex-col safe-bottom">
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6">
        <motion.div 
          className="w-full max-w-sm"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {/* Icon */}
          <motion.div variants={iconItem} className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 bg-secondary rounded-2xl flex items-center justify-center shadow-lg">
                <Fuel className="w-12 h-12 text-secondary-foreground" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">7</span>
              </div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1 variants={item} className="text-2xl font-bold text-primary-foreground text-center mb-2">
            {postoName}
          </motion.h1>
          <motion.p variants={item} className="text-primary-foreground/70 text-center text-sm mb-6">
            Sistema de Fidelidade
          </motion.p>

          {/* White Card Container */}
          <motion.div variants={item}>
            <Card className="bg-card p-5 rounded-2xl shadow-xl mb-6">
              {/* Impactful Welcome Message */}
              <div className="text-center mb-5">
                <motion.p 
                  className="text-xl font-bold text-foreground mb-3"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                >
                  🎯 Quer economizar de verdade?
                </motion.p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Você está a <span className="font-semibold text-primary">um passo</span> de participar de 
                  <span className="font-semibold text-primary"> sorteios semanais</span>, receber 
                  <span className="font-semibold text-primary"> descontos exclusivos</span> e ficar por dentro de 
                  <span className="font-semibold text-primary"> produtos, serviços e ofertas</span> do nosso grupo!
                </p>
              </div>

              {/* Benefits Icons */}
              <motion.div 
                className="flex justify-center gap-5 py-4 border-t border-border/50"
                variants={container}
                initial="hidden"
                animate="show"
              >
                <motion.div variants={iconItem} className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">Sorteios</span>
                </motion.div>
                <motion.div variants={iconItem} className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">Promoções</span>
                </motion.div>
                <motion.div variants={iconItem} className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Fuel className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">Descontos</span>
                </motion.div>
                <motion.div variants={iconItem} className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">Novidades</span>
                </motion.div>
                <motion.div variants={iconItem} className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <Store className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">Serviços</span>
                </motion.div>
              </motion.div>

              {/* CTA Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  onClick={onNext} 
                  className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 mt-4 shadow-lg"
                >
                  Quero Participar!
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </Card>
          </motion.div>

          {/* Footer text */}
          <motion.p variants={item} className="text-primary-foreground/80 text-center text-xs font-medium">
            📲 Receba informativos de produtos, serviços e promoções diárias do grupo!
          </motion.p>
          <motion.p variants={item} className="text-primary-foreground/60 text-center text-[10px] mt-1">
            ⚡ Leva menos de 30 segundos para se cadastrar
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
