const {ref, onMounted} = Vue

export function useApiCache(endpoint, params = {}) {
  const data = ref([])
  const isLoading = ref(true)
  const error = ref(null)
  
  const cacheKey = `${endpoint}:${JSON.stringify(params)}`
  console.log(cacheKey);
  
  const etagKey = `${cacheKey}_etag`
  console.log(etagKey);

  async function fetchData() {
    isLoading.value = true
    error.value = null
    
    try {
      const cached = localStorage.getItem(cacheKey)
      const savedEtag = localStorage.getItem(etagKey)
      
      const headers = {}
      if (savedEtag) headers['If-None-Match'] = savedEtag
      
      const url = `/fetch_${endpoint}${
        Object.keys(params).length 
          ? '?' + new URLSearchParams(params).toString() 
          : ''
      }`
      console.log(headers);
      
      
      const response = await fetch(url, { headers })
      console.log(response);
      
      
      if (response.status === 304 && cached) {
        data.value = JSON.parse(cached)
        return
      }
      
      const { data: responseData, etag } = await response.json()
      data.value = responseData
      localStorage.setItem(cacheKey, JSON.stringify(responseData))
      localStorage.setItem(etagKey, etag)
    } catch (err) {
      error.value = err
      const cached = localStorage.getItem(cacheKey)
      if (cached) data.value = JSON.parse(cached)
    } finally {
      isLoading.value = false
      console.log(isLoading.value);
      
    }
  }

  onMounted(fetchData)

  return {
    data,
    isLoading,
    error,
    refresh: fetchData
  }
}