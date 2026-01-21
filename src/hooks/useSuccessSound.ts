import { useCallback } from 'react';

export const useSuccessSound = () => {
  const playSuccessSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create a pleasant success chime with multiple notes
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 (C major chord)
      
      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        const startTime = audioContext.currentTime + index * 0.1;
        const duration = 0.3;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });
    } catch (error) {
      console.log('Audio not supported');
    }
  }, []);

  const playTickSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 1200; // High frequency tick
      oscillator.type = 'sine';
      
      const startTime = audioContext.currentTime;
      const duration = 0.05; // Very short tick
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    } catch (error) {
      console.log('Audio not supported');
    }
  }, []);

  const playCountdownEndSound = useCallback(() => {
    try {
      // Trigger vibration if supported (mobile devices)
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 150]); // Short pattern: vibrate-pause-vibrate-pause-vibrate
      }

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Short notification beep sequence - descending tones
      const notes = [880, 660, 440]; // A5, E5, A4 - descending pattern
      
      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        const startTime = audioContext.currentTime + index * 0.12;
        const duration = 0.15;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });
    } catch (error) {
      console.log('Audio not supported');
    }
  }, []);

  return { playSuccessSound, playTickSound, playCountdownEndSound };
};
