"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import SignatureCanvas from "react-signature-canvas"
import { Button, Modal } from "antd"

interface SimpleAnnotationEditorProps {
  initialImage?: string
  onSave: (dataUrl: string | null) => void
  onCancel: () => void
}

const SimpleAnnotationEditor: React.FC<SimpleAnnotationEditorProps> = ({ initialImage, onSave, onCancel }) => {
  const [isModalVisible, setIsModalVisible] = useState(true)
  const sigCanvas = useRef<SignatureCanvas | null>(null)
  const [image, setImage] = useState<string | null>(initialImage || null)

  useEffect(() => {
    if (initialImage) {
      setImage(initialImage)
    }
  }, [initialImage])

  const handleOk = () => {
    if (sigCanvas.current) {
      const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png")
      onSave(dataUrl)
    } else {
      onSave(null)
    }
    setIsModalVisible(false)
  }

  const handleCancel = () => {
    onCancel()
    setIsModalVisible(false)
  }

  const clear = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear()
    }
  }

  return (
    <Modal
      title="Annotation Editor"
      visible={isModalVisible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={800}
      footer={[
        <Button key="back" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button key="clear" onClick={clear}>
          Clear
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk}>
          Save
        </Button>,
      ]}
    >
      {image && (
        <div className="mb-4">
          <img src={image || "/placeholder.svg"} alt="Background" style={{ maxWidth: "100%", maxHeight: "300px" }} />
        </div>
      )}
      <div style={{ width: "100%", height: "300px", position: "relative" }}>
        <SignatureCanvas
          ref={sigCanvas}
          penColor="green"
          canvasProps={{
            className: "touch-none border border-gray-300 rounded-md relative z-10 bg-white",
            width: 760,
            height: 300,
            style: { backgroundColor: "white" },
          }}
        />
      </div>
    </Modal>
  )
}

export default SimpleAnnotationEditor
