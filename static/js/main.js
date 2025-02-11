(function () {
    "use strict";

    /**
     * ================================================
     *  Bagian 1: Fungsi Utilitas
     * ================================================
     */

    /**
     * Fungsi untuk melakukan fetch dengan handling modal processing dan error.
     * @param {string} endpoint - URL endpoint untuk fetch.
     * @param {object} options - Opsi fetch (method, headers, body, dll.).
     * @param {boolean} showLoading - Apakah menampilkan modal loading.
     * @returns {Promise<object|null>} - Respons JSON atau null jika error.
     */
    async function apiFetch(endpoint, options = {}, showLoading = true) {
        if (showLoading) {
            showProcessingModal();
        }
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            // Asumsi respons JSON
            return await response.json();
        } catch (error) {
            if (showLoading) {
                showModal(`Terjadi kesalahan: ${error.message}`);
            } else {
                console.error(`Error fetching ${endpoint}:`, error);
            }
            return null;
        } finally {
            if (showLoading) {
                hideProcessingModal();
            }
        }
    }

    /**
     * Fungsi untuk melakukan fetch tanpa menampilkan modal loading.
     * @param {string} endpoint - URL endpoint untuk fetch.
     * @param {object} options - Opsi fetch (method, headers, body, dll.).
     * @returns {Promise<object|null>} - Respons JSON atau null jika error.
     */
    async function apiFetchNoLoading(endpoint, options = {}) {
        return await apiFetch(endpoint, options, false);
    }

    /**
     * Menampilkan modal processing.
     */
    function showProcessingModal() {
        const processingModal = document.getElementById("processingModal");
        if (processingModal) {
            processingModal.classList.remove("hidden");
            processingModal.setAttribute("aria-hidden", "false");
        }
    }

    /**
     * Menyembunyikan modal processing.
     */
    function hideProcessingModal() {
        const processingModal = document.getElementById("processingModal");
        if (processingModal) {
            processingModal.classList.add("hidden");
            processingModal.setAttribute("aria-hidden", "true");
        }
    }

    /**
     * Menampilkan modal dengan pesan tertentu.
     * @param {string} message - Pesan yang akan ditampilkan.
     */
    function showModal(message) {
        const modalMessage = document.getElementById("modalMessage");
        const modal = document.getElementById("modal");
        modalMessage.textContent = message;
        modal.classList.remove("hidden");
        const modalClose = document.getElementById("modalClose");
        modalClose.focus();
    }

    /**
     * ================================================
     *  Bagian 2: Variabel DOM dan Inisialisasi Awal
     * ================================================
     */
    const video = document.getElementById("video"),
        uploadInput = document.getElementById("uploadInput"),
        evidenceFilesInput = document.getElementById("evidenceFilesInput"),
        preview = document.getElementById("preview"),
        placeholder = document.getElementById("placeholder"),
        scanButton = document.getElementById("scanButton"),
        submitButton = document.getElementById("submitButton"),
        accountIdSelect = document.getElementById("accountIdSelect"),
        rencanaIdSelect = document.getElementById("rencanaIdSelect"),
        currencySelect = document.getElementById("currencySelect"),
        currencySymbol = document.getElementById("currencySymbol"),
        amountInput = document.getElementById("amountInput"),
        uraianInput = document.getElementById("uraianInput"),
        judulLaporanInput = document.getElementById("judulLaporanInput"),
        receiptLinkInput = document.getElementById("receiptLinkInput"),
        evidenceLinksInput = document.getElementById("evidenceLinksInput"),
        modal = document.getElementById("modal"),
        modalMessage = document.getElementById("modalMessage"),
        modalClose = document.getElementById("modalClose"),
        rencanaModal = document.getElementById("rencanaModal"),
        rencanaDetailsDiv = document.getElementById("rencanaDetails"),
        rencanaNoButton = document.getElementById("rencanaNoButton"),
        rencanaYesButton = document.getElementById("rencanaYesButton"),
        processingModal = document.getElementById("processingModal"),
        reviewInfo = document.getElementById("reviewInfo"),
        nextToStep2 = document.getElementById("nextToStep2"),
        nextToStep3 = document.getElementById("nextToStep3"),
        backToStep2 = document.getElementById("backToStep2");

    // Variabel error
    const amountError = document.getElementById("amountError"),
        accountError = document.getElementById("accountError"),
        rencanaError = document.getElementById("rencanaError"),
        uraianError = document.getElementById("uraianError"),
        judulError = document.getElementById("judulError");

    let stream,
        photoTaken = false;

    /**
     * ================================================
     *  Bagian 3: Fungsi Kamera
     * ================================================
     */

    /**
     * Memulai kamera dengan mencoba kamera belakang, fallback ke depan jika gagal.
     */
    function startCamera() {
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then((s) => {
                stream = s;
                video.srcObject = stream;
                video.classList.remove("hidden");
                placeholder.classList.add("hidden");
                scanButton.disabled = false;
            })
            .catch((error) => {
                console.warn("Kamera belakang gagal, mencoba kamera depan:", error);
                // Fallback ke kamera depan
                navigator.mediaDevices
                    .getUserMedia({ video: { facingMode: "user" } })
                    .then((s) => {
                        stream = s;
                        video.srcObject = stream;
                        video.classList.remove("hidden");
                        placeholder.classList.add("hidden");
                        scanButton.disabled = false;
                    })
                    .catch((err) => {
                        console.error("Akses kamera ditolak atau tidak didukung:", err);
                        showModal("Akses kamera ditolak atau tidak didukung.");
                        placeholder.classList.remove("hidden");
                        scanButton.disabled = true;
                    });
            });
    }

    /**
     * Mengambil gambar dari video dan memprosesnya.
     */
    function captureImage() {
        if (!photoTaken) {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext("2d");
            context.drawImage(video, 0, 0);
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        processReceiptImage(blob); // Proses OCR
                    } else {
                        showModal("Gagal menangkap gambar. Silakan coba lagi.");
                    }
                },
                "image/png",
                0.8
            );
            preview.src = canvas.toDataURL("image/png");
            preview.classList.remove("hidden");
            video.classList.add("hidden");
            placeholder.classList.add("hidden");
            photoTaken = true;
            nextToStep2.disabled = true; // Nonaktif dulu sampai OCR selesai
        } else {
            resetCamera();
        }
    }

    /**
     * Mengembalikan kamera ke keadaan awal.
     */
    function resetCamera() {
        preview.classList.add("hidden");
        video.classList.remove("hidden");
        photoTaken = false;
        nextToStep2.disabled = true;
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        startCamera();
    }

    /**
     * ================================================
     *  Bagian 4: Fungsi Pemrosesan Gambar (OCR) - MODIFIED for Gemini API
     * ================================================
     */

    /**
     * Memproses gambar yang diambil dari kamera atau diupload menggunakan Gemini API.
     * @param {Blob} file - File gambar yang akan diproses.
     */
    async function processReceiptImage(file) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await apiFetch("/upload_file", {
            method: "POST",
            body: formData,
        });

        if (response && response.extracted_text) { // Check if extracted_text exists in response
            const extractedTotal = parseFloat(response.extracted_text); // Assume backend sends total as number/number string

            if (!isNaN(extractedTotal)) {
                amountInput.value = extractedTotal.toFixed(2); // Display with 2 decimals, adjust format if needed
                showModal("Nilai total berhasil diekstrak oleh Gemini, Silakan Periksa!");
                nextToStep2.disabled = false;
                document.getElementById("formModal").classList.remove("hidden");
                evidenceFilesInput.focus();
            } else {
                showModal(
                    "Gemini gagal mengekstrak jumlah yang valid. Silakan masukkan secara manual."
                );
                nextToStep2.disabled = true;
            }
        } else {
            document.getElementById("formModal").classList.remove("hidden");
            nextToStep2.disabled = false;
            showModal(
                `Maaf: ${response ? response.error || "Gemini gagal membaca total. Silakan masukkan Jumlah Manual!" : "Silakan masukkan Jumlah Manual!"}`
            );
        }
    }


    /**
     * ================================================
     *  Bagian 5: Unggah Gambar
     * ================================================
     */

    /**
     * Event listener untuk mengunggah gambar secara manual.
     */
    uploadInput.addEventListener("change", () => {
        const file = uploadInput.files[0];
        if (file) {
            if (!file.type.startsWith("image/")) {
                showModal("Silakan unggah file gambar yang valid.");
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.classList.remove("hidden");
                video.classList.add("hidden");
                placeholder.classList.add("hidden");
                photoTaken = true;
                nextToStep2.disabled = true;
            };
            reader.readAsDataURL(file);

            processReceiptImage(file);
        }
    });

    /**
     * ================================================
     *  Bagian 6: Fetch Data Dropdown (Rencana & Akun)
     * ================================================
     */

    async function fetchData() {
        const [idRencanaData, accountSkkosData] = await Promise.all([
            apiFetch("/fetch_id_rencana"),
            apiFetch("/fetch_account_skkos"),
        ]);

        if (idRencanaData) {
            const rencanaSelect = document.getElementById("rencanaIdSelect");
            rencanaSelect.innerHTML = `<option value="" selected disabled>Pilih ID Rencana</option>`; // Reset opsi
            idRencanaData.forEach((id) => {
                const option = document.createElement("option");
                option.value = id;
                option.textContent = id;
                rencanaSelect.appendChild(option);
            });
        }

        if (accountSkkosData) {
            const accountSelect = document.getElementById("accountIdSelect");
            accountSelect.innerHTML = `<option value="" selected disabled>Pilih Akun SKKO</option>`; // Reset opsi
            accountSkkosData.forEach((account) => {
                const option = document.createElement("option");
                option.value = account;
                option.textContent = account;
                accountSelect.appendChild(option);
            });
        }
    }

    /**
     * Menangani perubahan pada input ID Rencana untuk menampilkan modal rincian.
     */
    async function handleRencanaIdChange() {
        const selectedIdRencana = rencanaIdSelect.value;
        console.log("Rencana ID dipilih:", selectedIdRencana);
        if (!selectedIdRencana) return;

        const data = await apiFetch(
            `/get_rencana_details?rencana_id=${encodeURIComponent(selectedIdRencana)}`
        );
        if (!data) {
            console.error("Data rincian rencana gagal diambil.");
            return;
        }

        const formatter = new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        });
        const formattedNominal = formatter.format(data.nominal);

        const sanitizedDetails = `
            <p><strong>Tanggal Mulai A/R:</strong> ${sanitizeHTML(data.start_date_ar)}</p>
            <p><strong>Tanggal Akhir A/R:</strong> ${sanitizeHTML(data.end_date_ar)}</p>
            <p><strong>Peminta:</strong> ${sanitizeHTML(data.requestor)}</p>
            <p><strong>Unit:</strong> ${sanitizeHTML(data.unit)}</p>
            <p><strong>Nominal:</strong> ${sanitizeHTML(formattedNominal)}</p>
            <p><strong>ID Rencana:</strong> ${sanitizeHTML(data.id_rencana)}</p>
        `;
        rencanaDetailsDiv.innerHTML = sanitizedDetails;
        rencanaModal.classList.remove("hidden");
        rencanaYesButton.focus();
    }

    /**
     * ================================================
     *  Bagian 7: Validasi Form & Submit
     * ================================================
     */

    /**
     * Sanitasi input untuk mencegah XSS.
     * @param {string} str - String yang akan disanitasi.
     * @returns {string} - String yang sudah disanitasi.
     */
    function sanitizeHTML(str) {
        const temp = document.createElement("div");
        temp.textContent = str;
        return temp.innerHTML;
    }

    /**
     * Event listener untuk validasi dan menampilkan ringkasan form.
     */
    nextToStep3.addEventListener("click", () => {
        let hasError = false;

        // Validasi Akun SKKO
        if (accountIdSelect.value) {
            accountError.classList.add("hidden");
        } else {
            accountError.classList.remove("hidden");
            hasError = true;
        }

        // Validasi ID Rencana
        if (rencanaIdSelect.value) {
            rencanaError.classList.add("hidden");
        } else {
            rencanaError.classList.remove("hidden");
            hasError = true;
        }

        // Validasi lainnya tetap sama
        if (amountInput.value) {
            amountError.classList.add("hidden");
        } else {
            amountError.classList.remove("hidden");
            hasError = true;
        }

        if (uraianInput.value.trim()) {
            uraianError.classList.add("hidden");
        } else {
            uraianError.classList.remove("hidden");
            hasError = true;
        }

        if (judulLaporanInput.value.trim()) {
            judulError.classList.add("hidden");
        } else {
            judulError.classList.remove("hidden");
            hasError = true;
        }

        if (hasError) return;

        // Tampilkan ringkasan
        document.getElementById("formModal").classList.add("hidden");
        document.getElementById("summaryModal").classList.remove("hidden");

        reviewInfo.innerHTML = `
            <p><strong>Jumlah:</strong> ${sanitizeHTML(amountInput.value)}</p>
            <p><strong>Mata Uang:</strong> ${sanitizeHTML(currencySelect.value)}</p>
            <p><strong>Akun SKKO:</strong> ${sanitizeHTML(accountIdSelect.value)}</p>
            <p><strong>ID Rencana:</strong> ${sanitizeHTML(rencanaIdSelect.value)}</p>
            <p><strong>Uraian:</strong> ${sanitizeHTML(uraianInput.value)}</p>
            <p><strong>Judul Laporan:</strong> ${sanitizeHTML(judulLaporanInput.value)}</p>
        `;
        submitButton.disabled = false;
        submitButton.focus();
    });

    /**
     * Event listener untuk kembali ke langkah sebelumnya dari ringkasan.
     */
    backToStep2.addEventListener("click", () => {
        document.getElementById("summaryModal").classList.add("hidden");
        document.getElementById("formModal").classList.remove("hidden");
        document.getElementById("closeModalButton").focus();
    });

    /**
     * Event listener untuk submit form.
     */
    submitButton.addEventListener("click", async () => {
        const selectedIdRencana = rencanaIdSelect.value;
        const selectedAccountId = accountIdSelect.value;
        const currency = currencySelect.value;
        const totalAmount = amountInput.value;
        const uraian = uraianInput.value;
        const judulLaporan = judulLaporanInput.value;
        const evidenceFiles = evidenceFilesInput.files;

        submitButton.disabled = true;

        const payload = new FormData();
        payload.append("rencana_id", selectedIdRencana);
        payload.append("account_skkos_id", selectedAccountId);
        payload.append("currency", currency);
        payload.append("amount", totalAmount);
        payload.append("uraian", uraian);
        payload.append("judulLaporan", judulLaporan);

        if (evidenceFiles.length > 0) {
            for (let i = 0; i < evidenceFiles.length; i++) {
                payload.append("evidence_files", evidenceFiles[i]);
            }
        }

        console.log("Mengirim data:", {
            rencana_id: selectedIdRencana,
            account_skkos_id: selectedAccountId,
            currency,
            amount: totalAmount,
            uraian,
            judulLaporan,
            evidence_files: evidenceFiles.length,
        });

        const result = await apiFetch("/submit", {
            method: "POST",
            body: payload,
        });

        if (result && result.success) {
            document.getElementById("summaryModal").classList.add("hidden");
            showModal("Data berhasil dikirim!");
            resetForm();
        } else {
            document.getElementById("summaryModal").classList.add("hidden");
            showModal(
                `Pengiriman gagal: ${result ? result.message || "Unknown error" : "Null"}`
            );
        }
        submitButton.disabled = false;
    });

    /**
     * Mengembalikan form ke keadaan awal.
     */
    function resetForm() {
        rencanaIdSelect.value = "";
        accountIdSelect.value = "";
        currencySelect.value = "IDR";
        currencySymbol.textContent = "Rp";
        amountInput.value = "";
        uraianInput.value = "";
        judulLaporanInput.value = "";
        receiptLinkInput.value = "";
        evidenceLinksInput.value = "";
        evidenceFilesInput.value = "";
        uploadInput.value = "";
        submitButton.disabled = true;
        nextToStep2.disabled = true;
        amountError.classList.add("hidden");
        accountError.classList.add("hidden");
        rencanaError.classList.add("hidden");
        uraianError.classList.add("hidden");
        judulError.classList.add("hidden");
        if (photoTaken) {
            resetCamera();
        }
        startCamera();
    }

    /**
     * ================================================
     *  Bagian 8 (UPDATE): Inisialisasi Choice.js
     * ================================================
     */

    /**
     * Menginisialisasi Choice.js pada elemen select.
     */
    function initializeChoiceJS() {
        const accountSelect = new Choices('#accountIdSelect', {
            searchEnabled: true,
            placeholderValue: 'Pilih Akun SKKO',
            shouldSort: false,
            itemSelectText: '',
        });

        const rencanaSelect = new Choices('#rencanaIdSelect', {
            searchEnabled: true,
            placeholderValue: 'Pilih ID Rencana',
            shouldSort: false,
            itemSelectText: '',
        });
    }

    /**
     * ================================================
     *  Bagian 9: Event Listener Global
     * ================================================
     */

    // Mengganti event listener 'change' pada rencanaIdSelect dengan rencanaIdSelect (tetap sama)
    rencanaIdSelect.addEventListener("change", handleRencanaIdChange);

    // Event listener untuk tombol "Next to Step 2"
    nextToStep2.addEventListener("click", function () {
        document.getElementById("formModal").classList.remove("hidden");
        evidenceFilesInput.focus();
    });

    // Event listener untuk tombol "Close Modal Form"
    document.getElementById("closeModalButton").addEventListener("click", function () {
        document.getElementById("formModal").classList.add("hidden");
        nextToStep2.focus();
    });

    // Event listener untuk tombol "TIDAK" di modal rincian Rencana
    rencanaNoButton.addEventListener("click", () => {
        rencanaIdSelect.value = "";
        rencanaModal.classList.add("hidden");
        rencanaIdSelect.focus();
    });

    // Event listener untuk tombol "YA" di modal rincian Rencana
    rencanaYesButton.addEventListener("click", () => {
        rencanaModal.classList.add("hidden");
    });

    // Event listener untuk tombol "Close" pada modal umum
    modalClose.addEventListener("click", () => {
        modal.classList.add("hidden");
        document.activeElement.blur();
    });

    // Event listener untuk tombol pemindaian (scan)
    scanButton.addEventListener("click", () => captureImage());

    /**
     * ================================================
     *  Bagian 10: Inisialisasi Saat Halaman Dimuat
     * ================================================
     */
    window.addEventListener("DOMContentLoaded", async () => {
        startCamera();
        await fetchData(); // Mengisi dropdown Rencana & Akun
        initializeChoiceJS(); // Inisialisasi Choice.js
        await populateJudulLaporanSuggestions(); // Mengisi datalist Judul Laporan tanpa loading
        await populateUraianSuggestions(); // Mengisi datalist Uraian tanpa loading
    });

    /**
     * Event listener untuk menghilangkan splash screen setelah halaman dimuat.
     */
    window.addEventListener("load", function () {
        const splashScreen = document.getElementById("splashScreen");
        setTimeout(() => {
            splashScreen.classList.add("hide");
        }, 3000);
    });

    /**
     * ================================================
     *  Bagian 11: Fungsi untuk Mengambil dan Mengisi Datalists
     * ================================================
     */

    /**
     * Mengambil saran Judul Laporan dari server dan mengisi datalist tanpa menampilkan loading modal.
     */
    async function populateJudulLaporanSuggestions() {
        const judulOptions = document.getElementById("judulLaporanOptions");
        const suggestions = await apiFetchNoLoading("/fetch_judul_laporan_suggestions");
        console.log("Judul Laporan Suggestions:", suggestions); // Tambahkan log

        if (suggestions && Array.isArray(suggestions)) {
            judulOptions.innerHTML = ""; // Bersihkan opsi sebelumnya
            suggestions.forEach((judul) => {
                const option = document.createElement("option");
                option.value = judul;
                judulOptions.appendChild(option);
            });
        } else {
            judulOptions.innerHTML = `<option value="No suggestions available.">No suggestions available.</option>`;
        }
    }

    /**
     * Mengambil saran Uraian dari server dan mengisi datalist tanpa menampilkan loading modal.
     */
    async function populateUraianSuggestions() {
        const uraianOptions = document.getElementById("uraianOptions");
        const suggestions = await apiFetchNoLoading("/fetch_uraian_laporan_suggestions");
        console.log("Uraian Suggestions:", suggestions); // Tambahkan log

        if (suggestions && Array.isArray(suggestions)) {
            uraianOptions.innerHTML = ""; // Bersihkan opsi sebelumnya
            suggestions.forEach((uraian) => {
                const option = document.createElement("option");
                option.value = uraian;
                uraianOptions.appendChild(option);
            });
        } else {
            uraianOptions.innerHTML = `<option value="No suggestions available.">No suggestions available.</option>`;
        }
    }

})();