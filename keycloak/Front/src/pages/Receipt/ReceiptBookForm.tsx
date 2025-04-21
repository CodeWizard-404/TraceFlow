import ReceiptBook from "pages/models/ReceiptBook";
import React from "react";

const ReceiptBookForm: React.FC<{
    isEdit: boolean;
    receiptBook: Partial<ReceiptBook>;
    setReceiptBook: (book: Partial<ReceiptBook>) => void;
    formError: string | null;
    t: (key: string, options?: Record<string, unknown>) => string;
    handleSubmit: () => void;
    handleCancel: () => void;
    handleNumberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleNumberBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}> = React.memo(
    ({
        isEdit,
        receiptBook,
        setReceiptBook,
        formError,
        t,
        handleSubmit,
        handleCancel,
        handleNumberChange,
        handleNumberBlur,
    }) => (
        <div className="bg-white shadow-md rounded-lg p-6">
            {/* Form header */}
            <h3 className="text-xl font-semibold mb-4">
                {isEdit
                    ? t("receiptBooks.form.editTitle", { number: receiptBook.number })
                    : t("receiptBooks.form.createTitle")}
            </h3>
            {formError && <div className="text-red-600 mb-4">{formError}</div>}
            {/* Number input */}
            <div className="mb-4">
                <label htmlFor={isEdit ? "editNumber" : "newNumber"} className="block mb-1">
                    {t("receiptBooks.form.labels.number")}
                </label>
                <input
                    id={isEdit ? "editNumber" : "newNumber"}
                    type="text"
                    value={receiptBook.number || ""}
                    onChange={handleNumberChange}
                    onBlur={handleNumberBlur}
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder={t("receiptBooks.form.placeholders.enterNumber")}
                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label={t("receiptBooks.form.placeholders.enterNumber")}
                />
            </div>
            {/* Type select */}
            <div className="mb-4">
                <label htmlFor={isEdit ? "editType" : "newType"} className="block mb-1">
                    {t("receiptBooks.form.labels.type")}
                </label>
                <select
                    id={isEdit ? "editType" : "newType"}
                    value={receiptBook.type || ""}
                    onChange={(e) => setReceiptBook({ ...receiptBook, type: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                    aria-label={t("receiptBooks.form.placeholders.selectType")}
                >
                    {!isEdit && (
                        <option value="" disabled>
                            {t("receiptBooks.form.placeholders.selectType")}
                        </option>
                    )}
                    {Object.keys(t("receiptBooks.types", { returnObjects: true })).map((key) => (
                        <option key={key} value={key}>
                            {t(`receiptBooks.types.${key}`)}
                        </option>
                    ))}
                </select>
            </div>
            {/* Form actions */}
            <div className="flex space-x-4">
                <button
                    onClick={handleSubmit}
                    className="p-2 bg-blue-500 text-white rounded-lg"
                    aria-label={t(isEdit ? "receiptBooks.actions.aria.save" : "receiptBooks.actions.aria.create")}
                >
                    {t(isEdit ? "receiptBooks.actions.save" : "receiptBooks.actions.create")}
                </button>
                <button
                    onClick={handleCancel}
                    className="p-2 bg-gray-500 text-white rounded-lg"
                    aria-label={t("receiptBooks.actions.aria.cancel")}
                >
                    {t("receiptBooks.actions.cancel")}
                </button>
            </div>
        </div>
    )
);

export default ReceiptBookForm;