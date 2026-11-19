import React, { useEffect, useState } from "react";
import { Button, Modal } from "@deepseek-ai/dsh-client-ui-primitives";
import { renderCloudImage } from "./cloud.js";

async function saveImage({ blob, url }, fileActions) {
  const name = "wordcloud.png";
  if (fileActions?.canSaveAs) {
    const result = await fileActions.save({ url, name, mediaType: blob.type, read: async () => blob }, "saveAs");
    return result.status === "saved";
  }

  let file;
  try {
    file = await window.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: "PNG", accept: { "image/png": [".png"] } }],
      excludeAcceptAllOption: true,
    });
  } catch (error) {
    if (error.name === "AbortError") return false;
    throw error;
  }
  await blob.stream().pipeTo(await file.createWritable());
  return true;
}

export function ShareDialog({ bands, getFileActions, onClose, onSaved, t }) {
  const [image, setImage] = useState(null);
  const [problem, setProblem] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    let url;
    renderCloudImage(bands).then((blob) => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setImage({ blob, url });
    }).catch(() => {
      if (active) setProblem("imageError");
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [bands]);

  function close() {
    if (!saving) onClose();
  }

  async function save() {
    if (!image || saving) return;
    setProblem(null);
    setSaving(true);
    try {
      const fileActions = getFileActions();
      if (!fileActions?.canSaveAs && typeof window.showSaveFilePicker !== "function") {
        setProblem("saveUnavailable");
      } else if (await saveImage(image, fileActions)) {
        onClose();
        onSaved();
      }
    } catch {
      setProblem("saveError");
    } finally {
      setSaving(false);
    }
  }

  return <Modal open onClose={close} title={t("share")} closeLabel={t("close")} className="wc-share-dialog"
    footer={<>
      <Button variant="outline" data-modal-autofocus disabled={saving} onClick={close}>{t("cancel")}</Button>
      <Button variant="primary" disabled={!image || saving} onClick={save}>{t("saveImage")}</Button>
    </>}>
    {image && <img className="wc-share-image" src={image.url}
      alt={bands.flatMap(({ words }) => words.map(({ text }) => text)).join(" · ")} />}
    {problem && <p className="wc-share-error" role="alert">{t(problem)}</p>}
    {!image && !problem && <p className="wc-share-loading" role="status">{t("loading")}</p>}
  </Modal>;
}
