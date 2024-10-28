'use client'
import React, { useRef, useState, KeyboardEvent, BaseSyntheticEvent } from 'react'

export default function OTP({code, onSubmit} : {code: number, onSubmit: (validated: boolean) => void}) {
  const [arrayValue, setArrayValue] = useState<(string | number)[]>(['', '', '', ''])
  const [maskedValue, setMaskedValue] = useState<(string | number)[]>(['', '', '', ''])
  const [attempts, setAttempts] = useState(1);
  const [foundCode, setFoundCode] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  React.useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  React.useEffect(() => {
    if (!arrayValue.includes('') && attempts < 6) {
      handleSubmit();
    }
  }, [arrayValue])

  const onPaste = (e: React.ClipboardEvent, index: number) => {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').split('')
    if (paste.every((item) => !isNaN(Number(item)))) {
      let newInputValue = [...arrayValue]
      let newMaskedValue = [...maskedValue]
      for (let i = 0; i < paste.length; i++) {
        if (index + i < arrayValue.length) {
          newInputValue[index + i] = paste[i]
          newMaskedValue[index + i] = '*'
        }
      }
      setArrayValue(newInputValue)
      setMaskedValue(newMaskedValue)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const keyCode = parseInt(e.key)
    if (
      e.key !== 'Backspace' &&
      e.key !== 'Delete' &&
      e.key !== 'Tab' &&
      !(e.metaKey && e.key === 'v') &&
      !(keyCode >= 0 && keyCode <= 9)
    ) {
      e.preventDefault()
    }
  }

  const onChange = (e: BaseSyntheticEvent, index: number) => {
    const input = e.target.value

    if (!isNaN(input)) {
      setArrayValue((preValue: (string | number)[]) => {
        const newArray = [...preValue]
        newArray[index] = input
        return newArray
      })

      setMaskedValue((prevValue: (string | number)[]) => {
        const newArray = [...prevValue]
        newArray[index] = '*'
        return newArray
      })

      if (input !== '' && index < arrayValue.length - 1) {
        inputRefs.current[index + 1]?.focus()
      }
    }
  }

  const onKeyUp = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      setArrayValue((prevValue: (string | number)[]) => {
        const newArray = [...prevValue]
        newArray[index] = ''
        return newArray
      })

      setMaskedValue((prevValue: (string | number)[]) => {
        const newArray = [...prevValue]
        newArray[index] = ''
        return newArray
      })

      if (index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    }
  }

  const handleSubmit = () => {
    setAttempts(prevAttempts => prevAttempts + 1);
    const input = arrayValue.join('');
    
    if (parseInt(input) == code) {
      setFoundCode(true);
      onSubmit(true);
    } else if (attempts > 4) {
      setFoundCode(false);
      onSubmit(false);
    }
  }

  return (
    attempts < 6 &&
    <div className='flex flex-col gap-y-2'>
      {
        (attempts < 6 && attempts > 1 && !foundCode) &&
        <span className='text-red-700 block'>Remaining attempts: {6 - attempts}</span>
      }
      <div className="flex gap-x-2">
          {
            maskedValue.map((value: string | number, index: number) => (
                <input
                  key={`index-${index}`}
                  ref={(el) => el && (inputRefs.current[index] = el)}
                  inputMode="numeric"
                  maxLength={1}
                  name="passcode"
                  type="text"
                  value={String(value)}
                  onChange={(e) => onChange(e, index)}
                  onKeyUp={(e) => onKeyUp(e, index)}
                  onKeyDown={(e) => onKeyDown(e)}
                  onPaste={(e) => onPaste(e, index)}
                  className="w-10 h-10 border-[1px] rounded-md border-gray-200 text-black text-center"
                  autoComplete="off"
                  accessKey={String(index)}
                />
            ))
          }
      </div>
    </div>
  )
}