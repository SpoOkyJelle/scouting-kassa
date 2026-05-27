import { useState, useCallback, useRef } from 'react';

export function useToast() {
  const [state, setState] = useState({ msg: '', visible: false });
  const timer = useRef(null);

  const toast = useCallback((msg) => {
    clearTimeout(timer.current);
    setState({ msg, visible: true });
    timer.current = setTimeout(() => setState(s => ({ ...s, visible: false })), 2200);
  }, []);

  return { toast, toastMsg: state.msg, toastVisible: state.visible };
}
