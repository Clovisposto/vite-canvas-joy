import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Check, Loader2, Phone } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StepPhoneProps {
  phone: string;
  lgpdConsent: boolean;
  acceptsPromo: boolean;
  lgpdText: string;
  onPhoneChange: (value: string) => void;
  onLgpdChange: (value: boolean) => void;
  onPromoChange: (value: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
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

export default function StepPhone({ 
  phone, 
  lgpdConsent, 
  acceptsPromo,
  lgpdText, 
  onPhoneChange, 
  onLgpdChange, 
  onPromoChange,
  onSubmit, 
  onBack, 
  loading 
}: StepPhoneProps) {
  const [error, setError] = useState('');
  const [lgpdError, setLgpdError] = useState('');

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPhoneChange(formatPhone(e.target.value));
  };

  const handleLgpdChange = (checked: boolean) => {
    onLgpdChange(checked);
    if (checked) {
      setLgpdError('');
    }
  };

  const validate = () => {
    // Validar LGPD primeiro - CRÍTICO: bloqueia totalmente sem consentimento
    if (!lgpdConsent) {
      setLgpdError('Obrigatório aceitar o termo para prosseguir.');
      setError('');
      return false;
    }
    setLgpdError('');

    const digits = phone.replace(/\D/g, '');
    
    // Celular brasileiro: DDD (2 dígitos) + 9 + 8 dígitos = 11 dígitos
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
    <div className="min-h-screen-ios bg-gradient-to-b from-primary to-primary/90 flex flex-col overflow-y-auto safe-bottom">
      {/* Header */}
      <motion.div 
        className="p-4 shrink-0"
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
      <div className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 py-4 pb-8">
        <motion.div 
          className="w-full max-w-sm"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {/* Icon */}
          <motion.div variants={iconItem} className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-secondary rounded-2xl flex items-center justify-center shadow-lg">
              <Phone className="w-10 h-10 text-secondary-foreground" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1 variants={item} className="text-2xl font-bold text-primary-foreground text-center mb-3">
            Seu telefone
          </motion.h1>

          {/* Description */}
          <motion.p variants={item} className="text-primary-foreground/80 text-center text-sm mb-6">
            Informe seu número para participar
          </motion.p>

          {/* White Card Container */}
          <motion.div variants={item}>
            <Card className="bg-card p-5 rounded-2xl shadow-xl">
              <div className="space-y-4">
                {/* Phone Input */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Label htmlFor="phone" className="text-sm font-medium text-foreground">
                    Telefone (obrigatório)
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="h-12 text-lg mt-2"
                  />
                </motion.div>

                {/* Error Message para telefone */}
                <AnimatePresence>
                  {error && (
                    <motion.p 
                      className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* LGPD Checkbox - OBRIGATÓRIO */}
                <motion.div 
                  className={`p-3 sm:p-4 rounded-xl border transition-all ${
                    lgpdError 
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-500' 
                      : 'bg-muted/50 border-border/50'
                  }`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Label className="text-xs sm:text-sm font-semibold text-foreground block mb-2 sm:mb-3">
                    Termo de Consentimento LGPD <span className="text-red-600">*</span>
                  </Label>
                  <div className="flex items-start space-x-3 sm:space-x-4">
                    <Checkbox
                      id="lgpd"
                      checked={lgpdConsent}
                      onCheckedChange={(c) => handleLgpdChange(!!c)}
                      className={`mt-0.5 h-5 w-5 sm:h-6 sm:w-6 min-w-5 sm:min-w-6 ${lgpdError ? 'border-red-500' : ''}`}
                    />
                    <Label htmlFor="lgpd" className="text-xs sm:text-sm text-muted-foreground leading-relaxed cursor-pointer select-none">
                      Autorizo o uso dos meus dados pessoais para cadastro e participação nas promoções do Posto 7, nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados – LGPD).
                    </Label>
                  </div>
                  
                  {/* Erro LGPD */}
                  <AnimatePresence>
                    {lgpdError && (
                      <motion.p 
                        className="text-xs sm:text-sm text-red-600 font-medium mt-2 sm:mt-3 flex items-center gap-1"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <span className="text-red-600">⚠️</span> Obrigatório aceitar o termo para prosseguir.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Checkbox de Promoções - OPCIONAL */}
                <motion.div 
                  className="flex items-start space-x-3 sm:space-x-4 p-3 rounded-xl bg-muted/30 border border-border/30"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <Checkbox
                    id="promo"
                    checked={acceptsPromo}
                    onCheckedChange={(c) => onPromoChange(!!c)}
                    className="mt-0.5 h-5 w-5 sm:h-6 sm:w-6 min-w-5 sm:min-w-6"
                  />
                  <Label htmlFor="promo" className="text-xs sm:text-sm text-muted-foreground leading-relaxed cursor-pointer select-none">
                    Concordo em receber comunicações promocionais e informativos das empresas do Grupo Pará via WhatsApp.
                  </Label>
                </motion.div>

                {/* CTA Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Confirmar
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            </Card>
          </motion.div>

          {/* Footer text */}
          <motion.p variants={item} className="text-primary-foreground/60 text-center text-xs mt-4">
            Seus dados estão protegidos pela LGPD
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
