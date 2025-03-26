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
      currencyOptions: ['IDR', 'USD'],
    };
  },
  setup() {
    // Gunakan composable cache untuk setiap dropdown
    const { 
      data: pemohonOptions, 
      isLoading: loadingPemohon 
    } = useApiCache('pemohon')
    
    const { 
      data: accountableOptions, 
      isLoading: loadingAccountable 
    } = useApiCache('accountable')
    
    const { 
      data: unitOptions, 
      isLoading: loadingUnit 
    } = useApiCache('unit')
    
    const { 
      data: satuanOptions, 
      isLoading: loadingSatuan 
    } = useApiCache('satuan')

    console.log(loadingAccountable.value, loadingPemohon.value, loadingUnit.value, loadingSatuan.value);
    

    return {
      pemohonOptions,
      accountableOptions,
      unitOptions,
      satuanOptions,
      loadingPemohon,
      loadingAccountable,
      loadingUnit,
      loadingSatuan
    }
  },
  computed: {
    totalKeseluruhan() {
      return this.form.daftarBarang.reduce((sum, barang) => sum + Number(barang.total), 0);
    },
    isLoadingData() {
      return this.loadingPemohon || this.loadingAccountable || 
             this.loadingUnit || this.loadingSatuan
    }
  },
  mounted() {
    this.$nextTick(() => {
      // Auto-focus ke field pertama saat modal terbuka
      if (this.$refs.firstField) {
        this.$refs.firstField.focus()
      }
    })
  },
  methods: {
    openMessageModal(message, status) {
      this.isSuccess = status
      this.showMessageModal = true
      this.modalMessage = message
    },
    closeMessageModal() {
      this.showMessageModal = false
    },
    // Tambahkan manual refresh jika diperlukan
    async refreshDropdowns() {
      try {
        await Promise.all([
          this.pemohonOptions.refresh(),
          this.accountableOptions.refresh(),
          this.unitOptions.refresh(),
          this.satuanOptions.refresh()
        ])
        this.openMessageModal("Data dropdown berhasil diperbarui", true)
      } catch (error) {
        console.error("Gagal refresh:", error)
        this.openMessageModal("Gagal memperbarui data", false)
      }
    }
  }
}