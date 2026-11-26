import { useEffect, useRef, useState } from 'react';

interface ArabicRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => ArabicRecognition;

function recognitionConstructor() {
  const browser = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

const recognitionErrors: Record<string, string> = {
  'not-allowed': 'اسمح باستخدام الميكروفون من إعدادات الموقع، ثم حاول مجددًا.',
  'service-not-allowed': 'خدمة الإملاء غير متاحة في إعدادات المتصفح.',
  'audio-capture': 'تعذّر الوصول إلى الميكروفون. تحقق من اتصال الجهاز.',
  'no-speech': 'لم يُلتقط كلام. حاول التحدث بالقرب من الميكروفون.',
  network: 'تعذّر الاتصال بخدمة الإملاء في المتصفح.',
  'language-not-supported': 'الإملاء بالعربية غير متاح في هذا المتصفح.',
};

export function useAssistantVoice(onTranscript: (text: string) => void) {
  const recognizer = useRef<ArabicRecognition | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');

  function releaseMicrophone() {
    const current = recognizer.current;
    if (!current) return;
    recognizer.current = null;
    current.onresult = null;
    current.onerror = null;
    current.onend = null;
    current.abort();
  }

  function cancelPlayback() {
    if (!utterance.current) return;
    utterance.current.onend = null;
    utterance.current.onerror = null;
    utterance.current = null;
    window.speechSynthesis.cancel();
  }

  function stopPlayback() {
    cancelPlayback();
    setSpeaking(false);
  }

  function resetVoice() {
    releaseMicrophone();
    stopPlayback();
    setListening(false);
    setVoiceMessage('');
  }

  useEffect(() => () => {
    releaseMicrophone();
    cancelPlayback();
  }, []);

  function toggleDictation() {
    if (recognizer.current) {
      recognizer.current.stop();
      return;
    }
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setVoiceMessage('الإملاء غير متاح في هذا المتصفح. يمكنك كتابة طلبك.');
      return;
    }

    stopPlayback();
    setVoiceMessage('');
    const current = new Recognition();
    recognizer.current = current;
    current.lang = 'ar-SA';
    current.interimResults = false;
    current.continuous = false;
    let hasSpeech = false;

    current.onresult = ({ results, resultIndex }) => {
      if (recognizer.current !== current) return;
      const text = Array.from(results).slice(resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(' ');
      if (text) {
        hasSpeech = true;
        onTranscript(text);
      }
    };
    current.onerror = ({ error }) => {
      if (recognizer.current !== current) return;
      hasSpeech = true;
      setVoiceMessage(recognitionErrors[error] || 'تعذّر الإملاء الصوتي. حاول مرة أخرى.');
    };
    current.onend = () => {
      if (recognizer.current !== current) return;
      recognizer.current = null;
      setListening(false);
      if (!hasSpeech) setVoiceMessage('لم يُلتقط كلام. يمكنك إعادة المحاولة.');
    };

    try {
      current.start();
      setListening(true);
    } catch {
      releaseMicrophone();
      setVoiceMessage('تعذّر تشغيل الميكروفون. حاول مرة أخرى.');
    }
  }

  function togglePlayback(text: string) {
    if (utterance.current) {
      stopPlayback();
      return;
    }
    const synthesis = window.speechSynthesis;
    const voices = synthesis.getVoices().filter((voice) => /^ar(?:-|_|$)/i.test(voice.lang));
    const voice = voices.find((voice) => voice.localService && /^ar[-_]sa$/i.test(voice.lang))
      ?? voices.find((voice) => voice.localService) ?? voices[0];
    if (!voice) {
      setVoiceMessage('الصوت العربي غير متاح حاليًا. فعّل صوتًا عربيًا في إعدادات جهازك.');
      return;
    }

    setVoiceMessage('');
    const current = new SpeechSynthesisUtterance(text);
    current.voice = voice;
    current.lang = voice.lang;
    utterance.current = current;
    current.onend = () => {
      if (utterance.current !== current) return;
      utterance.current = null;
      setSpeaking(false);
    };
    current.onerror = () => {
      if (utterance.current !== current) return;
      utterance.current = null;
      setSpeaking(false);
      setVoiceMessage('تعذّرت قراءة الرد صوتيًا.');
    };
    try {
      synthesis.speak(current);
      setSpeaking(true);
    } catch {
      stopPlayback();
      setVoiceMessage('تعذّرت قراءة الرد صوتيًا.');
    }
  }

  return {
    dictationAvailable: Boolean(recognitionConstructor()),
    playbackAvailable: Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance),
    listening, speaking, voiceMessage, resetVoice, toggleDictation, togglePlayback,
  };
}
