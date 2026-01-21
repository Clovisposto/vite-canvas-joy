import { useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface StepConfirmationProps {
  onComplete: () => void;
}

export default function StepConfirmation({ onComplete }: StepConfirmationProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete]);

  // Calculate progress for circular indicator (0 to 100)
  const progress = ((5 - countdown) / 5) * 100;
  const circumference = 2 * Math.PI * 20; // radius = 20
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="min-h-screen-ios bg-primary flex flex-col items-center justify-center px-6 safe-bottom">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <Card className="bg-card p-8 rounded-2xl shadow-lg border-0 text-center">
          {/* Ícone de sucesso */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="mb-6"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
          </motion.div>

          {/* Título */}
          <h1 className="text-xl font-bold text-foreground mb-3">
            Participação confirmada
          </h1>

          {/* Mensagem */}
          <p className="text-muted-foreground text-sm mb-8">
            Seus dados foram registrados com sucesso.
          </p>

          {/* Contador circular discreto */}
          <div className="flex justify-center">
            <div className="relative w-14 h-14">
              {/* Background circle */}
              <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="3"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              {/* Countdown number */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-semibold text-primary">{countdown}</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
