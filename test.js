const { ref} = Vue
import { useApiCache } from './useApiCache.js'

export default {
  data() {
    return {
      isLoading: false,
      showMessageModal: false,
      modalMessage: '',
      isSuccess: true,
      loadingFetchData: true,
      form: {
        pemohon: '',
        noHp: '',
        accountable: '',
        unit: '',
        perihal: '',
        daftarBarang: [{
          nama: '',
          satuan: '',
          harga: 0,
          currency: 'IDR',
          jumlah: 0,
          total: 0,
          manual: false
        }]
      },
      error: {
        pemohon: '',
        noHp: '',
        accountable: '',
        unit: '',
        perihal: '',
        daftarBarang: [{
          nama: '',
          satuan: '',
          harga: '',
          currency: '',
          jumlah: '',
          total: '',
        }]
      },
      pemohonOptions: [],
      accountableOptions: [],
      unitOptions: [],
      satuanOptions: [],
      currencyOptions: ['IDR', 'USD'],
    }
  },
  computed: {
    totalKeseluruhan() {
      return this.form.daftarBarang.reduce((sum, barang) => sum + Number(barang.total), 0);
    }

  },
  mounted() {
    // this.fetchDataPerencanaan();
    this.fetchAllData();
  },
  methods: {
    async fetchDataPerencanaan() {
      try {
        this.loadingFetchData = true;

        await Promise.all([
          this.fetchPemohon(),
          this.fetchAccountable(),
          this.fetchUnit(),
          this.fetchSatuan(),
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
        this.openMessageModal("data Gagal Dimuat",false)
      } finally {
        this.loadingFetchData = false;
      }
    },
    async fetchAllData() {
      try {
        this.loadingFetchData = true;
        // Fetch all data in parallel
        const [
          pemohonResult,
          accountableResult, 
          unitResult,
          satuanResult
        ] = await Promise.all([
          useApiCache('pemohon'),
          useApiCache('accountable'),
          useApiCache('unit'),
          useApiCache('satuan')
        ])

        // Update data and loading states
        this.pemohonOptions = pemohonResult.data.value
        this.accountableOptions = accountableResult.data.value
        this.unitOptions = unitResult.data.value
        this.satuanOptions = satuanResult.data.value

      } catch (error) {
        console.error("Failed to load dropdowns:", error)
        this.openMessageModal("data Gagal Dimuat",false)
      }finally {
        this.loadingFetchData = false
      }
    },

    // async fetchPemohon() {
    //   try {
    //     const response = await fetch("/fetch_pemohon");
    //     if (!response.ok) throw new Error("Gagal mengambil data pemohon");
    //     const data = await response.json();
    //     if (data.error) throw new Error(data.error);
    //     this.pemohonOptions = data.pemohon || "";
    //   } catch (error) {
    //     console.error("Error fetching pemohon:", error);
    //   } 
    // },

    // async fetchAccountable() {
    //   try {
    //     const response = await fetch("/fetch_accountable");
    //     if (!response.ok) throw new Error("Gagal mengambil data accountable");
    //     const data = await response.json();
    //     if (data.error) throw new Error(data.error);
    //     this.accountableOptions = data.accountable || "";
    //   } catch (error) {
    //     console.error("Error fetching accountable:", error);
    //   } 
    // },

    // async fetchUnit() {
    //   try {
    //     const response = await fetch("/fetch_unit");
    //     if (!response.ok) throw new Error("Gagal mengambil data unit");
    //     const data = await response.json();
    //     if (data.error) throw new Error(data.error);
    //     this.unitOptions = data.unit || "";
    //   } catch (error) {
    //     console.error("Error fetching unit:", error);
    //   }
    // },

    // async fetchSatuan() {
    //   try {
    //     const response = await fetch("/fetch_satuan");
    //     if (!response.ok) throw new Error("Gagal mengambil data satuan");
    //     const data = await response.json();
    //     if (data.error) throw new Error(data.error);
    //     this.satuanOptions = data.satuan || "";
    //   } catch (error) {
    //     console.error("Error fetching satuan:", error);
    //   }
    // },

    formatPrice(value) {
      if (!value) return "0";
      return Number(value).toLocaleString("id-ID"); // Format angka dengan koma
    },

    updateHarga(event, index) {
      // const rawValue = event.target.value.replace(/\D/g, ""); // Hanya angka
      let rawValue = event.target.value;
      this.form.daftarBarang[index].harga = parseFloat(rawValue) || 0;
      this.hitungTotal(index);
    },
    hitungTotal(index) {
      const barang = this.form.daftarBarang[index];
      if (!barang.manual) {
        if (barang.currency === 'USD') {
          barang.total = barang.harga * barang.jumlah * 16000
        } else {
          barang.total = barang.harga * barang.jumlah;
        }
      }
    },
    manualTotal(index) {
      this.form.daftarBarang[index].manual = true;
    },
    tambahBarang() {
      this.form.daftarBarang.push({
        nama: '',
        satuan: '',
        currency: 'IDR',
        harga: 0,
        jumlah: 0,
        total: 0,
        manual: false
      });
      this.error.daftarBarang.push({
        nama: '',
        satuan: '',
        harga: '',
        currency: '',
        jumlah: '',
        total: '',
      });
    },
    hapusBarang(index) {
      if (this.form.daftarBarang.length > 1) {
        this.form.daftarBarang.splice(index, 1);
      }
    },
    async submitForm() {
      // Validasi sederhana
      this.resetErrors();
      if (this.validateForm()) return;

      try {
        this.isLoading = true;

        const formData = {
          ...this.form,
          total: this.totalKeseluruhan,
          daftarBarang: this.form.daftarBarang.map(barang => ({
            ...barang,
            harga: Number(barang.harga),
            jumlah: Number(barang.jumlah),
            total: Number(barang.total)
          }))
        };

        const response = await fetch("/submit/perencanaan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });
        // const response = {
        //   ok: true,
        //   json: () => Promise.resolve({ success: true, data: formData })
        // }
        // console.log(response);
        // setTimeout(() => {
        //   this.isLoading = true;
        // }, 1000);
        if (!response.ok) throw new Error('Gagal mengirim data');
        console.log(response);

        const result = await response.json();

        if (result.success) {
          this.$emit('submit-success', result.data);
          this.openMessageModal('Pengajuan Berhasil Di Submit',true)
          this.resetForm();
        } else {
          throw new Error(result.message || 'Terjadi kesalahan');
        }
      } catch (error) {
        this.openMessageModal('Pengajuan Gagal',false)

      } finally {
        this.isLoading = false;
      }
    },
    resetForm() {
      // Reset nilai form ke default
      this.form = {
        pemohon: '',
        noHp: '',
        accountable: '',
        unit: '',
        perihal: '',
        daftarBarang: [{
          nama: '',
          satuan: '',
          harga: 0,
          jumlah: 0,
          total: 0,
          currency: 'IDR', // Nilai default untuk currency
          manual: false
        }],
        total: 0
      };

      // Reset error messages
      this.errors = {
        pemohon: '',
        noHp: '',
        accountable: '',
        unit: '',
        perihal: '',
        daftarBarang: []
      };

      // Reset state tambahan jika ada
      this.totalKeseluruhan = 0;

      // Optional: Reset validasi form library (jika menggunakan Vuelidate dll)
      if (this.$v) {
        this.$v.$reset();
      }
    },
    resetErrors() {
      this.error = {
        pemohon: '',
        noHp: '',
        accountable: '',
        unit: '',
        perihal: '',
        daftarBarang: this.form.daftarBarang.map(() => ({
          nama: '',
          satuan: '',
          harga: '',
          currency: '',
          jumlah: '',
          total: '',
        }))
      };
    },
    validateForm() {
      let hasError = false;
      // resetErrors();
      const requiredFields = ['pemohon', 'noHp', 'accountable', 'unit', 'perihal'];
      requiredFields.forEach(field => {
        if (!this.form[field]) {
          this.error[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} wajib diisi`;
          hasError = true;
        }
      });

      this.form.daftarBarang.forEach((barang, index) => {
        const errors = this.validateBarang(barang);
        if (Object.keys(errors).length > 0) {
          this.error.daftarBarang[index] = errors;
          hasError = true;
        }
      });

      return hasError;
    },

    validateBarang(barang) {
      const errors = {};
      const requiredFields = ['nama', 'satuan', 'harga', 'currency', 'jumlah', 'total'];

      requiredFields.forEach(field => {
        if (!barang[field]) {
          errors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} wajib diisi`;
        }
      });

      return errors;
    },

    kembali() {
      if (confirm('Apakah anda yakin ingin kembali? Perubahan yang belum disimpan akan hilang.')) {
        // Simulasi navigasi kembali
        window.location.href = '/'; // Ganti dengan URL sebenarnya
      }
    },
    closeMessageModal() {
      this.showMessageModal = false
    },
    openMessageModal(message,status) {
      this.isSuccess=status
      this.showMessageModal = true
      this.modalMessage = message
    }
  },
  delimiters: ["${", "}"]
}