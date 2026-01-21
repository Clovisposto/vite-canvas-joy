import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Gift, ArrowLeft, ArrowRight, MessageCircle, Check, Zap, Fuel, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface StepRaffleProps {
  value: boolean | null;
  onChange: (v: boolean) => void;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
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

export default function StepRaffle({ value, onChange, onNext, onBack, onClose }: StepRaffleProps) {
  const handleContinue = () => {
    if (value === true) {
      // Vai direto para próxima etapa (telefone)
      onNext();
    } else if (value === false) {
      onClose();
    }
  };

  return (
    <div className="min-h-screen-ios bg-gradient-to-b from-primary to-primary/90 flex flex-col safe-bottom">
      {/* Header */}
      <motion.div 
        className="p-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack} 
          className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </motion.div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6">
        <motion.div 
          className="w-full max-w-sm"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {/* Icon */}
          <motion.div variants={iconItem} className="flex justify-center mb-5">
            <div className="w-18 h-18 bg-secondary rounded-2xl flex items-center justify-center shadow-lg p-4">
              <Gift className="w-9 h-9 text-secondary-foreground" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1 variants={item} className="text-xl font-bold text-primary-foreground text-center mb-2">
            Participe e ganhe benefícios!
          </motion.h1>

          {/* Description */}
          <motion.p variants={item} className="text-primary-foreground/80 text-center text-sm mb-4">
            Receba ofertas exclusivas via{' '}
            <span className="inline-flex items-center gap-1 text-green-400 font-medium">
              <MessageCircle className="w-3.5 h-3.5" />WhatsApp
            </span>
          </motion.p>

          {/* White Card Container */}
          <motion.div variants={item}>
            <Card className="bg-card p-4 rounded-2xl shadow-xl">
              {/* Benefits Section */}
              <div className="space-y-3 mb-4">
                {/* Sorteios */}
                <motion.div 
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200/50"
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-md flex-shrink-0">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm">Sorteios Semanais</p>
                    <p className="text-xs text-muted-foreground">
                      Concorra a <span className="font-bold text-yellow-600">3 prêmios de R$ 100</span> toda semana
                    </p>
                  </div>
                </motion.div>

                {/* Promoções Relâmpago - Destaque Principal */}
                <motion.div 
                  className="relative p-4 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 shadow-lg overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {/* Animated flash effect */}
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                  />
                  
                  {/* Sparkle effects */}
                  <motion.div
                    className="absolute top-2 right-4 text-yellow-200"
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.7, 1, 0.7]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Zap className="w-5 h-5" />
                  </motion.div>
                  
                  <div className="relative flex items-center gap-3">
                    <motion.div 
                      className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg flex-shrink-0 border border-white/30"
                      animate={{ 
                        boxShadow: ['0 0 10px rgba(255,255,255,0.3)', '0 0 20px rgba(255,255,255,0.5)', '0 0 10px rgba(255,255,255,0.3)']
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Zap className="w-6 h-6 text-white" />
                    </motion.div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-white text-base">⚡ PROMOÇÃO RELÂMPAGO</p>
                      </div>
                      <p className="text-white/95 text-sm font-medium leading-tight">
                        Descontos de <span className="font-black text-yellow-200 text-base">R$ 0,05 a R$ 0,80</span> por litro!
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <MessageCircle className="w-4 h-4 text-green-300" />
                        <span className="text-white/90 text-xs font-semibold">
                          Fique atento no WhatsApp!
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Badge */}
                  <motion.div 
                    className="absolute -top-1 -right-1 px-2.5 py-1 bg-yellow-300 text-orange-800 text-[10px] font-black rounded-full shadow-md transform rotate-12"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    EXCLUSIVO
                  </motion.div>
                </motion.div>

                {/* Economia */}
                <motion.div 
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50"
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md flex-shrink-0">
                    <Fuel className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm">Economia Real</p>
                    <p className="text-xs text-muted-foreground">
                      Fique atento às ofertas e <span className="font-bold text-green-600">economize muito!</span>
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Selection Question */}
              <p className="text-center text-sm font-medium text-foreground mb-3">
                Deseja participar?
              </p>

              {/* Selection Options */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onChange(true)}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                    value === true
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-muted bg-card text-muted-foreground hover:border-green-300'
                  }`}
                >
                  {value === true && <Check className="w-4 h-4" strokeWidth={3} />}
                  <span className="font-semibold text-sm">Sim</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onChange(false)}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                    value === false
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-muted bg-card text-muted-foreground hover:border-red-300'
                  }`}
                >
                  {value === false && <Check className="w-4 h-4" strokeWidth={3} />}
                  <span className="font-semibold text-sm">Não</span>
                </motion.button>
              </div>

              {/* CTA Button */}
              <Button
                onClick={handleContinue}
                disabled={value === null}
                className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                Continuar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Card>
          </motion.div>

          {/* Footer text */}
          <motion.p variants={item} className="text-primary-foreground/60 text-center text-xs mt-4">
            Agradecemos pela preferência, volte sempre!
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
