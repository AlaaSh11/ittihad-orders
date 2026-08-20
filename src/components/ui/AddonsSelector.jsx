import { useState } from 'react';

/**
 * AddonsSelector — Modal-based multi-select component for cake add-ons.
 *
 * Props:
 *   options   {Array<{id, label, price}>}  Full list of available add-ons
 *   selected  {string[]}                   Array of selected addon IDs
 *   onChange  {fn}                         Called with updated array of IDs
 */
export default function AddonsSelector({ options = [], selected = [], onChange }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleAddon = (id) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    onChange(next);
  };

  const removeAddon = (id) => {
    onChange(selected.filter((s) => s !== id));
  };

  return (
    <div className="flex flex-col gap-2 col-span-full">
      {/* Main Trigger Button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold py-2 px-5 rounded-lg text-sm transition-colors flex items-center gap-2 font-cairo shadow-sm"
        >
          <span>➕</span>
          <span>إضافة اكسسوارات</span>
        </button>
      </div>

      {/* Selected Items Badges */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mt-1">
          {selected.map((id) => {
            const addon = options.find((o) => o.id === id);
            if (!addon) return null;
            return (
              <span
                key={addon.id}
                className="inline-flex items-center gap-1.5 bg-[#e2495c] text-white px-2.5 py-1 rounded-full text-xs font-bold font-cairo shadow-sm"
              >
                <span>{addon.label}</span>
                <button
                  type="button"
                  onClick={() => removeAddon(addon.id)}
                  className="hover:bg-black/20 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                  aria-label="إزالة"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Pop-up Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="bg-[#f8f9fa] border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-[#1a1a2e] font-cairo text-lg">اختر الإضافات</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Options */}
            <div className="p-4 flex flex-col gap-2">
              {options.map((addon) => {
                const isSelected = selected.includes(addon.id);
                return (
                  <div
                    key={addon.id}
                    onClick={() => toggleAddon(addon.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all select-none ${
                      isSelected 
                        ? 'border-[#e2495c] bg-[#fdf0f2]' 
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                    }`}
                  >
                    <span className={`font-bold font-cairo text-sm ${isSelected ? 'text-[#e2495c]' : 'text-gray-700'}`}>
                      {addon.label}
                    </span>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                      isSelected ? 'bg-[#e2495c] border-[#e2495c]' : 'bg-white border-gray-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg w-full font-cairo shadow transition-colors active:scale-95"
              >
                تأكيد وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
