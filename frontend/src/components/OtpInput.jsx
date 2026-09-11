import React, { useRef, useEffect, useState } from "react";
import "./OtpInput.css";

export default function OtpInput({ length = 6, value = "", onChange, disabled = false }) {
  const [otpArray, setOtpArray] = useState(new Array(length).fill(""));
  const inputRefs = useRef([]);

  useEffect(() => {
    // Sync external string value to array state
    const valArr = value.split("");
    const newArr = new Array(length).fill("");
    for (let i = 0; i < length; i++) {
      if (valArr[i]) {
        newArr[i] = valArr[i];
      }
    }
    setOtpArray(newArr);
  }, [value, length]);

  const triggerChange = (newArr) => {
    const otpString = newArr.join("");
    onChange(otpString);
  };

  const handleKeyDown = (e, index) => {
    if (disabled) return;
    
    if (e.key === "Backspace") {
      e.preventDefault();
      const newArr = [...otpArray];
      
      if (otpArray[index] !== "") {
        // Clear current box
        newArr[index] = "";
        setOtpArray(newArr);
        triggerChange(newArr);
      } else if (index > 0) {
        // Clear previous box and focus it
        newArr[index - 1] = "";
        setOtpArray(newArr);
        triggerChange(newArr);
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1].focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1].focus();
    }
  };

  const handleChange = (e, index) => {
    if (disabled) return;
    const val = e.target.value;
    
    // Only allow numbers
    if (val && !/^\d+$/.test(val)) return;

    const newArr = [...otpArray];
    // Take only the last character (if someone typed fast or multiple chars)
    newArr[index] = val.slice(-1);
    
    setOtpArray(newArr);
    triggerChange(newArr);

    // Auto-advance
    if (val && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    if (disabled) return;
    
    const pasteData = e.clipboardData.getData("text/plain").replace(/\D/g, "").slice(0, length);
    if (!pasteData) return;

    const newArr = new Array(length).fill("");
    for (let i = 0; i < pasteData.length; i++) {
      newArr[i] = pasteData[i];
    }
    setOtpArray(newArr);
    triggerChange(newArr);
    
    // Focus the next empty box or the last box
    const nextIndex = Math.min(pasteData.length, length - 1);
    inputRefs.current[nextIndex].focus();
  };

  return (
    <div className="otp-input-container">
      {otpArray.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          className="otp-box"
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={digit}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          disabled={disabled}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}
