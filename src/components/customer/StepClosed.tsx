import { useEffect, useState } from 'react';
import { CheckCircle, Heart, Sparkles, Star, Gift, Trophy, Zap, Fuel } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { supabase } from '@/integrations/supabase/client';

interface StepClosedProps {
  postoName: string;
  declinedRaffle?: boolean;
}

interface ThankYouSettings {
  primaryColor: string;
  secondaryColor: string;
  title: string;
  message: string;
  subtitle: string;
  logoUrl: string;
  backgroundUrl: string;
}

// Confetti particle component
const ConfettiParticle = ({ delay, color }: { delay: number; color: string }) => {
  const randomX = Math.random() * 100;
  const randomRotation = Math.random() * 720 - 360;
  const randomDuration = 3 + Math.random() * 2;
  const shapes = ['rounded-full', 'rounded-sm', 'rounded-none'];
  const shape = shapes[Math.floor(Math.random() * shapes.length)];
  const size = 4 + Math.random() * 8;

  return (
    <motion.div
      className={`absolute ${shape}`}
      style={{
        left: `${randomX}%`,
        top: '-20px',
        width: size,
        height: size,
        backgroundColor: color,
      }}
      initial={{ y: -20, opacity: 1, rotate: 0 }}
      animate={{
        y: typeof window !== 'undefined' ? window.innerHeight + 100 : 1000,
        opacity: [1, 1, 0],
        rotate: randomRotation,
        x: [0, Math.random() * 100 - 50, Math.random() * 200 - 100],
      }}
      transition={{
        duration: randomDuration,
        delay: delay,
        ease: 'linear',
      }}
    />
  );
};

// Floating icon component
const FloatingIcon = ({ icon: Icon, delay, color }: { icon: React.ElementType; delay: number; color: string }) => {
  const randomX = 10 + Math.random() * 80;
  const randomY = 10 + Math.random() * 80;

  return (
    <motion.div
      className="absolute"
      style={{ left: `${randomX}%`, top: `${randomY}%` }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.7, 0],
        scale: [0, 1.2, 0.8],
        y: [0, -30, -60],
      }}
      transition={{
        duration: 2.5,
        delay: delay,
        repeat: Infinity,
        repeatDelay: 1 + Math.random() * 2,
      }}
    >
      <Icon className="w-6 h-6" style={{ color }} />
    </motion.div>
  );
};

// Burst ring animation
const BurstRing = ({ delay, color }: { delay: number; color: string }) => (
  <motion.div
    className="absolute inset-0 rounded-full border-4"
    style={{ borderColor: color }}
    initial={{ scale: 0.5, opacity: 1 }}
    animate={{ scale: 3, opacity: 0 }}
    transition={{
      duration: 1,
      delay: delay,
      ease: 'easeOut',
    }}
  />
);

export default function StepClosed({ postoName, declinedRaffle = false }: StepClosedProps) {
  const [showThankYou, setShowThankYou] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const { playSuccessSound } = useSuccessSound();
  
  const [settings, setSettings] = useState<ThankYouSettings>({
    primaryColor: '#10b981',
    secondaryColor: '#ef4444',
    title: 'Obrigado!',
    message: 'Volte sempre! Sua presença é muito importante para nós.',
    subtitle: 'Agradecemos sua visita ao',
    logoUrl: '',
    backgroundUrl: ''
  });

  const confettiColors = [
    settings.primaryColor,
    settings.secondaryColor,
    '#fbbf24',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
  ];

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', [
            'thank_you_primary_color',
            'thank_you_secondary_color',
            'thank_you_title',
            'thank_you_message',
            'thank_you_subtitle',
            'thank_you_logo_url',
            'thank_you_background_url'
          ]);

        if (data) {
          const newSettings = { ...settings };
          data.forEach((item) => {
            const value = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
            const cleanValue = value.replace(/^"|"$/g, '');
            
            switch (item.key) {
              case 'thank_you_primary_color':
                newSettings.primaryColor = cleanValue;
                break;
              case 'thank_you_secondary_color':
                newSettings.secondaryColor = cleanValue;
                break;
              case 'thank_you_title':
                newSettings.title = cleanValue;
                break;
              case 'thank_you_message':
                newSettings.message = cleanValue;
                break;
              case 'thank_you_subtitle':
                newSettings.subtitle = cleanValue;
                break;
              case 'thank_you_logo_url':
                newSettings.logoUrl = cleanValue;
                break;
              case 'thank_you_background_url':
                newSettings.backgroundUrl = cleanValue;
                break;
            }
          });
          setSettings(newSettings);
        }
      } catch (error) {
        console.error('Error loading thank you settings:', error);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    // Animation sequence
    const timer0 = setTimeout(() => setShowConfetti(true), 100);
    const timer1 = setTimeout(() => {
      setShowThankYou(true);
      playSuccessSound();
    }, 300);
    const timer2 = setTimeout(() => setShowHeart(true), 1000);
    const timer3 = setTimeout(() => setShowMessage(true), 1500);

    return () => {
      clearTimeout(timer0);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  useEffect(() => {
    // Countdown to close
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      
      if (isAndroid) {
        window.location.href = 'intent://launcher#Intent;action=android.intent.action.MAIN;category=android.intent.category.HOME;end';
      } else if (isIOS) {
        window.close();
        setTimeout(() => {
          window.location.href = 'about:blank';
        }, 300);
      } else {
        window.close();
        setTimeout(() => {
          try {
            window.location.href = 'about:blank';
          } catch {
            // Browser blocked
          }
        }, 500);
      }
    }
  }, [countdown]);

  return (
    <div className="min-h-screen-ios flex flex-col items-center justify-center p-6 text-center overflow-hidden relative safe-bottom"
      style={{
        background: settings.backgroundUrl 
          ? `url(${settings.backgroundUrl}) center/cover no-repeat`
          : `linear-gradient(135deg, ${settings.primaryColor}15 0%, transparent 40%, ${settings.secondaryColor}10 70%, ${settings.primaryColor}08 100%)`
      }}
    >
      {/* Overlay for background image */}
      {settings.backgroundUrl && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      )}

      {/* Confetti explosion - reduced for iOS performance */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-50" style={{ willChange: 'transform' }}>
            {[...Array(30)].map((_, i) => (
              <ConfettiParticle
                key={i}
                delay={Math.random() * 0.5}
                color={confettiColors[i % confettiColors.length]}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Floating icons background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingIcon icon={Star} delay={0.5} color={`${settings.primaryColor}60`} />
        <FloatingIcon icon={Heart} delay={1} color={`${settings.secondaryColor}60`} />
        <FloatingIcon icon={Sparkles} delay={1.5} color="#fbbf2460" />
        <FloatingIcon icon={Gift} delay={2} color="#3b82f660" />
        <FloatingIcon icon={Trophy} delay={2.5} color="#8b5cf660" />
        <FloatingIcon icon={Zap} delay={3} color="#ec489960" />
        <FloatingIcon icon={Star} delay={3.5} color={`${settings.primaryColor}60`} />
        <FloatingIcon icon={Heart} delay={4} color={`${settings.secondaryColor}60`} />
      </div>

      {/* Animated gradient orbs */}
      <motion.div
        className="absolute top-1/4 -left-20 w-60 h-60 rounded-full blur-3xl opacity-30"
        style={{ backgroundColor: settings.primaryColor }}
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 -right-20 w-60 h-60 rounded-full blur-3xl opacity-30"
        style={{ backgroundColor: settings.secondaryColor }}
        animate={{
          x: [0, -50, 0],
          y: [0, -30, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="max-w-md w-full relative z-10">
        {/* Logo animation */}
        <AnimatePresence>
          {showThankYou && settings.logoUrl && (
            <motion.div
              initial={{ opacity: 0, y: -30, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 200 }}
              className="mb-6"
            >
              <motion.img 
                src={settings.logoUrl} 
                alt="Logo do posto" 
                className="h-20 w-auto mx-auto object-contain drop-shadow-lg"
                animate={{
                  filter: ['drop-shadow(0 0 0px transparent)', `drop-shadow(0 0 20px ${settings.primaryColor}40)`, 'drop-shadow(0 0 0px transparent)'],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success checkmark animation with burst rings */}
        <AnimatePresence>
          {showThankYou && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 200, 
                damping: 12
              }}
              className="mb-8 relative"
            >
              {/* Burst rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-28 h-28">
                  <BurstRing delay={0.3} color={`${settings.primaryColor}40`} />
                  <BurstRing delay={0.5} color={`${settings.primaryColor}30`} />
                  <BurstRing delay={0.7} color={`${settings.primaryColor}20`} />
                </div>
              </div>

              {/* Main circle */}
              <motion.div 
                className="w-28 h-28 mx-auto rounded-full flex items-center justify-center shadow-2xl relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.primaryColor}cc 100%)`,
                  boxShadow: `0 25px 60px -12px ${settings.primaryColor}50, 0 0 80px ${settings.primaryColor}30`
                }}
                animate={{
                  boxShadow: [
                    `0 25px 60px -12px ${settings.primaryColor}50, 0 0 80px ${settings.primaryColor}30`,
                    `0 25px 60px -12px ${settings.primaryColor}70, 0 0 100px ${settings.primaryColor}50`,
                    `0 25px 60px -12px ${settings.primaryColor}50, 0 0 80px ${settings.primaryColor}30`,
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {/* Shine effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 1.5, delay: 0.5, repeat: Infinity, repeatDelay: 3 }}
                />
                
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
                >
                  <CheckCircle className="w-16 h-16 text-white drop-shadow-lg" strokeWidth={2.5} />
                </motion.div>
              </motion.div>

              {/* Floating sparkles around checkmark */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `rotate(${i * 60}deg) translateY(-60px)`,
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    delay: 0.8 + i * 0.1,
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: settings.primaryColor }} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Heart animation with pulse */}
        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="mb-6 relative"
            >
              {/* Glowing background */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <div
                  className="w-16 h-16 rounded-full blur-xl"
                  style={{ backgroundColor: settings.secondaryColor }}
                />
              </motion.div>

              <motion.div
                animate={{ 
                  scale: [1, 1.3, 1],
                }}
                transition={{ 
                  duration: 0.8, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="relative"
              >
                <Heart 
                  className="w-12 h-12 mx-auto drop-shadow-lg" 
                  style={{ color: settings.secondaryColor, fill: settings.secondaryColor }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thank you message with staggered animations */}
        <AnimatePresence>
          {showMessage && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <motion.h1 
                className="text-4xl font-bold text-foreground mb-4"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
              >
                <motion.span
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  }}
                  transition={{ duration: 5, repeat: Infinity }}
                  style={{
                    background: `linear-gradient(90deg, ${settings.primaryColor}, ${settings.secondaryColor}, ${settings.primaryColor})`,
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {settings.title}
                </motion.span>
              </motion.h1>
              
              <motion.p 
                className="text-lg text-muted-foreground mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {settings.subtitle}
              </motion.p>
              
              <motion.p 
                className="text-2xl font-bold mb-8"
                style={{ color: settings.primaryColor }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
              >
                {postoName}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="p-6 rounded-3xl bg-card/90 backdrop-blur-md border border-border/50 shadow-2xl"
                style={{
                  boxShadow: `0 25px 50px -12px ${settings.primaryColor}15`
                }}
              >
                {/* Mensagem principal de agradecimento */}
                <motion.div 
                  className="mb-5 p-5 rounded-2xl bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border border-green-200 relative overflow-hidden"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {/* Shine effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ duration: 2, delay: 0.8, repeat: Infinity, repeatDelay: 4 }}
                  />
                  
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="relative"
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Fuel className="w-5 h-5 text-green-600" />
                      <p className="text-green-800 font-bold text-lg">
                        Obrigado por abastecer conosco!
                      </p>
                      <Fuel className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-green-700 text-sm text-center">
                      Sua preferência é muito importante para nós.
                    </p>
                    <p className="text-green-600 text-xs text-center mt-1 font-medium">
                      💚 Volte sempre! Você faz parte da nossa família! 💚
                    </p>
                  </motion.div>
                </motion.div>

                {declinedRaffle && (
                  <motion.div 
                    className="mb-4 p-4 rounded-2xl bg-blue-50 border border-blue-200"
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <p className="text-blue-700 text-sm font-medium flex items-center justify-center gap-2">
                      🎯 Você optou por não participar do sorteio desta vez
                    </p>
                    <p className="text-blue-600 text-xs mt-1">
                      Na próxima visita, você pode mudar de ideia!
                    </p>
                  </motion.div>
                )}

                <motion.div 
                  className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <motion.p 
                    className="text-amber-700 text-sm font-semibold flex items-center justify-center gap-2"
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Zap className="w-4 h-4" />
                    Fique atento às promoções relâmpago!
                    <Zap className="w-4 h-4" />
                  </motion.p>
                </motion.div>

                {/* Mensagem de valorização do cliente */}
                <motion.div 
                  className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <div className="flex items-center justify-center gap-2 text-purple-700">
                    <Star className="w-4 h-4 fill-purple-400" />
                    <span className="text-sm font-medium">Você é especial para nós!</span>
                    <Star className="w-4 h-4 fill-purple-400" />
                  </div>
                  <p className="text-purple-600 text-xs text-center mt-1">
                    Conte sempre conosco para um atendimento de qualidade
                  </p>
                </motion.div>
                
                <motion.div 
                  className="flex items-center justify-center gap-3 text-sm text-muted-foreground/70"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                >
                  <span>Fechando em</span>
                  <motion.span
                    key={countdown}
                    initial={{ scale: 2, opacity: 0, rotate: -10 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl font-bold text-lg"
                    style={{ 
                      background: `linear-gradient(135deg, ${settings.primaryColor}25, ${settings.primaryColor}15)`,
                      color: settings.primaryColor,
                      boxShadow: `0 4px 15px ${settings.primaryColor}20`
                    }}
                  >
                    {countdown}
                  </motion.span>
                  <span>segundos</span>
                </motion.div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="mt-6 text-xs text-muted-foreground/50"
              >
                Agradecemos pela preferência! 🚗⛽
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
