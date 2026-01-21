import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  MessageCircle, 
  Check, 
  Star, 
  ThumbsUp, 
  RefreshCw,
  Trophy,
  Gift,
  Calendar,
  Phone,
  AlertCircle,
  Fuel
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StepFinalizationProps {
  customerPhone?: string;
  postoName: string;
  whatsappNumber: string;
  acceptsRaffle?: boolean;
  onReset?: () => void;
}

const AUTO_CLOSE_SECONDS = 15;

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

export default function StepFinalization({ 
  customerPhone,
  postoName, 
  whatsappNumber,
  acceptsRaffle = false,
  onReset 
}: StepFinalizationProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hasRated, setHasRated] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SECONDS);
  const { playSuccessSound, playTickSound, playCountdownEndSound } = useSuccessSound();
  const soundPlayed = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!soundPlayed.current) {
      soundPlayed.current = true;
      playSuccessSound();
    }
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          playCountdownEndSound();
          return 0;
        }
        playTickSound();
        return prev - 1;
      });
    }, 1000);
    
    const autoCloseTimer = setTimeout(() => {
      handleReset();
    }, AUTO_CLOSE_SECONDS * 1000);
    
    return () => {
      clearTimeout(autoCloseTimer);
      clearInterval(countdownInterval);
    };
  }, [playSuccessSound, playTickSound, playCountdownEndSound]);

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      window.location.href = window.location.pathname + window.location.search;
    }
  };

  const handleRating = async (stars: number) => {
    setRating(stars);
    setHasRated(true);
    
    try {
      // Save rating to database
      await supabase.from('complaints').insert({
        phone: customerPhone || null,
        message: `Avaliação: ${stars} estrelas`,
        status: 'resolved'
      });

      // Send automatic WhatsApp response if customer has phone
      if (customerPhone) {
        try {
          await supabase.functions.invoke('rating-response', {
            body: {
              phone: customerPhone,
              rating: stars,
              postoName: postoName
            }
          });
        } catch (waError) {
          console.log('WhatsApp auto-response not sent:', waError);
          // Don't show error to user, this is a background feature
        }
      }
    } catch (error) {
      console.error('Erro ao salvar avaliação:', error);
    }
    
    toast({
      title: 'Obrigado pela avaliação!',
      description: stars >= 4 
        ? 'Ficamos felizes com sua experiência! Você receberá uma mensagem de agradecimento.' 
        : stars <= 2 
          ? 'Entraremos em contato para melhorar sua experiência.'
          : 'Sua opinião é muito importante para nós.',
    });
  };

  const handleWhatsApp = () => {
    const phone = whatsappNumber?.replace(/\D/g, '') || '5594991324567';
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent('Olá, gostaria de saber mais sobre as promoções do Posto 7.')}`, '_blank');
  };

  return (
    <div className="min-h-screen-ios bg-gradient-to-b from-green-600 to-green-700 flex flex-col safe-bottom">
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
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              {acceptsRaffle ? (
                <Trophy className="w-10 h-10 text-green-600" />
              ) : (
                <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
              )}
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1 variants={item} className="text-2xl font-bold text-white text-center mb-2">
            {acceptsRaffle ? '🎉 Você está concorrendo!' : 'Atendimento Finalizado!'}
          </motion.h1>

          {/* Description */}
          <motion.p variants={item} className="text-white/80 text-center text-sm mb-6">
            {acceptsRaffle 
              ? 'Boa sorte no sorteio! Você será notificado caso seja o vencedor.'
              : <>Obrigado por visitar o <strong className="text-white">{postoName}</strong>!</>
            }
          </motion.p>

          {/* White Card Container */}
          <motion.div variants={item}>
            <Card className="bg-card p-5 rounded-2xl shadow-xl">
              {/* Raffle Info Section */}
              <AnimatePresence>
                {acceptsRaffle && (
                  <motion.div 
                    className="mb-5 pb-5 border-b border-border/50"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ delay: 0.3 }}
                  >
                    <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Gift className="w-4 h-4 text-primary" />
                      Regras do Sorteio
                    </h3>
                    
                    <motion.ul 
                      className="space-y-2 text-xs text-muted-foreground"
                      variants={container}
                      initial="hidden"
                      animate="show"
                    >
                      <motion.li variants={item} className="flex items-start gap-2">
                        <Trophy className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Prêmios:</strong> 3 sorteios de R$ 100,00</span>
                      </motion.li>
                      <motion.li variants={item} className="flex items-start gap-2">
                        <Calendar className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Data:</strong> Todo sábado às 17h</span>
                      </motion.li>
                      <motion.li variants={item} className="flex items-start gap-2">
                        <Phone className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Contato:</strong> Via telefone cadastrado</span>
                      </motion.li>
                      <motion.li variants={item} className="flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Atenção:</strong> 3 tentativas de contato</span>
                      </motion.li>
                      <motion.li variants={item} className="flex items-start gap-2">
                        <Fuel className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Promoções:</strong> Até R$ 0,80/litro de desconto</span>
                      </motion.li>
                    </motion.ul>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Rating Section */}
              <AnimatePresence mode="wait">
                {!hasRated ? (
                  <motion.div 
                    key="rating"
                    className="mb-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <h3 className="text-sm font-semibold text-foreground text-center mb-3">
                      Como foi seu atendimento?
                    </h3>
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star, index) => (
                        <motion.button
                          key={star}
                          onClick={() => handleRating(star)}
                          className={`p-1.5 rounded-full transition-all hover:scale-110 ${
                            rating && rating >= star 
                              ? 'text-yellow-400' 
                              : 'text-muted-foreground/30 hover:text-yellow-400/70'
                          }`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 + index * 0.05 }}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Star 
                            className="w-8 h-8" 
                            fill={rating && rating >= star ? 'currentColor' : 'none'}
                          />
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="rated"
                    className="mb-5 p-3 bg-green-50 rounded-xl border border-green-200"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <ThumbsUp className="w-4 h-4" />
                      <span className="text-sm font-semibold">Avaliação registrada!</span>
                    </div>
                    <div className="flex justify-center gap-0.5 mt-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star}
                          className={`w-4 h-4 ${
                            rating && rating >= star 
                              ? 'text-yellow-400 fill-yellow-400' 
                              : 'text-muted-foreground/20'
                          }`}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Countdown */}
              <motion.div 
                className="flex justify-center mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
                  <div className="relative w-4 h-4">
                    <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 20 20">
                      <circle
                        cx="10"
                        cy="10"
                        r="8"
                        fill="none"
                        stroke="hsl(var(--muted-foreground) / 0.3)"
                        strokeWidth="2"
                      />
                      <circle
                        cx="10"
                        cy="10"
                        r="8"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 8}
                        strokeDashoffset={2 * Math.PI * 8 * (1 - countdown / AUTO_CLOSE_SECONDS)}
                        className="transition-all duration-1000 ease-linear"
                      />
                    </svg>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Reiniciando em <strong className="text-foreground">{countdown}s</strong>
                  </span>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button 
                  onClick={handleWhatsApp} 
                  className="w-full h-11 text-sm font-semibold bg-[#25D366] hover:bg-[#20BD5A] text-white"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Falar com o Posto
                </Button>
                
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full h-11 text-sm font-semibold"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Novo Atendimento
                </Button>
              </motion.div>
            </Card>
          </motion.div>

          {/* Footer text */}
          <motion.p variants={item} className="text-white/60 text-center text-xs mt-4">
            Sua satisfação é nossa prioridade! 💚
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
