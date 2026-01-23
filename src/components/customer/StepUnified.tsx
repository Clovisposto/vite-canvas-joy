import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Fuel, Gift, Trophy, ArrowRight, 
  Phone, Loader2, Sparkles, MessageCircle, User
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logoGP from "@/assets/logo-gp.png";

interface StepUnifiedProps {
  postoName: string;
  phone: string;
  name: string;
  onPhoneChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.08 }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } }
};

export default function StepUnified({ 
  postoName, 
  phone,
  name,
  onPhoneChange,
  onNameChange,
  onSubmit, 
  loading 
}: StepUnifiedProps) {
  console.log('StepUnified: renderizando com props', { postoName, phone, name, loading });
  const [error, setError] = useState('');

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPhoneChange(formatPhone(e.target.value));
    if (error) setError('');
  };

  const validate = () => {
    // Validar nome (obrigatório)
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('Por favor, informe seu nome.');
      return false;
    }

    const digits = phone.replace(/\D/g, '');
    
    // Celular brasileiro: DDD (2 dígitos) + 9 + 8 dígitos = 11 dígitos
    // Fixo brasileiro: DDD (2 dígitos) + 8 dígitos = 10 dígitos
    if (digits.length !== 11) {
      setError('Telefone inválido. Digite DDD + 9 dígitos (ex: 11 99999-9999)');
      return false;
    }
    
    // Validar DDD (11-99 são válidos no Brasil)
    const ddd = parseInt(digits.slice(0, 2), 10);
    if (ddd < 11 || ddd > 99) {
      setError('DDD inválido. Use um DDD válido (11-99).');
      return false;
    }
    
    // Celular deve começar com 9
    if (digits[2] !== '9') {
      setError('Número de celular deve começar com 9 após o DDD.');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleSubmit = () => {
    if (validate()) onSubmit();
  };

  return (
    <div className="min-h-screen-ios bg-primary flex flex-col overflow-y-auto safe-bottom">
      {/* Header - Logo GP Premium */}
      <div className="px-6 pt-10 pb-8 text-center">
        <motion.div 
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Container premium para a logo */}
          <div className="relative inline-block mb-5">
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
          
          <h2 className="text-xl font-bold text-white mb-2">
            Quer economizar de verdade?
          </h2>
          <p className="text-white/80 text-sm">
            Participe de sorteios e receba descontos exclusivos
          </p>
        </motion.div>
      </div>

      {/* Card principal */}
      <div className="flex-1 px-5 pb-10">
        <motion.div 
          className="w-full max-w-md mx-auto"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item}>
            <Card className="bg-card p-6 rounded-2xl shadow-lg border-0">
              {/* Ícone e nome do posto */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-yellow-50 border-4 border-primary rounded-xl shadow-md mb-3">
                  <Fuel className="w-7 h-7 text-primary" />
                </div>
                <h1 className="text-lg font-bold text-primary">{postoName}</h1>
                <p className="text-muted-foreground text-sm mb-4">Sistema de Fidelidade</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Você está a <span className="font-semibold text-primary">um passo</span> de participar de{' '}
                  <span className="font-semibold text-primary">sorteios semanais</span>, receber{' '}
                  <span className="font-semibold text-primary">descontos exclusivos</span> e ficar por dentro de{' '}
                  <span className="font-semibold text-primary">produtos, serviços e ofertas</span> do nosso grupo.
                </p>
              </div>

              {/* Benefícios */}
              <div className="space-y-3 mb-6">
                {/* Sorteios Semanais */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/40">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">Sorteios Semanais</p>
                    <p className="text-xs text-muted-foreground">
                      3 prêmios de R$ 100 toda semana
                    </p>
                  </div>
                </div>

                {/* Promoções Exclusivas */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">Promoções Exclusivas</p>
                    <p className="text-xs text-white/85">
                      Descontos de R$ 0,05 a R$ 0,80 por litro
                    </p>
                  </div>
                </div>

                {/* Ofertas via WhatsApp */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/40">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">Ofertas via WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                      Receba novidades e promoções em primeira mão
                    </p>
                  </div>
                </div>
              </div>

              {/* Divisor */}
              <div className="border-t border-border/60 mb-6" />

              {/* Campo de nome */}
              <div className="mb-4">
                <Label htmlFor="name" className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-primary" />
                  Seu nome
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Digite seu nome"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  className="h-12 text-base border-2 border-border focus:border-primary transition-colors"
                />
              </div>

              {/* Campo de telefone */}
              <div className="mb-5">
                <Label htmlFor="phone" className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-primary" />
                  Seu telefone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="h-12 text-base border-2 border-border focus:border-primary transition-colors"
                />
              </div>

              {/* Mensagem de erro */}
              <AnimatePresence>
                {error && (
                  <motion.p 
                    className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg mb-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Botão CTA */}
              <Button 
                onClick={handleSubmit}
                disabled={loading}
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    Quero Participar
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              {/* Texto LGPD */}
              <p className="text-[10px] text-muted-foreground text-center mt-5 leading-relaxed">
                Ao clicar em "Quero Participar", você autoriza o uso das suas informações 
                conforme a LGPD (Lei nº 13.709/2018) para receber sorteios e promoções do Grupo Pará.
              </p>
            </Card>
          </motion.div>

          {/* Footer */}
          <motion.div variants={item} className="text-center mt-5">
            <p className="text-white/80 text-xs font-medium">
              Receba informativos de produtos, serviços e promoções
            </p>
            <p className="text-white/60 text-[10px] mt-1">
              Leva menos de 30 segundos
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
