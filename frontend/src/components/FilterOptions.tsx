import React from 'react'
import './FilterOptions.css'

interface FilterOptionsProps {
  filterType: string
  onFilterChange: (filterType: string) => void
  disabled?: boolean
}

const FilterOptions: React.FC<FilterOptionsProps> = ({ filterType, onFilterChange, disabled }) => {
  const filterCategories = [
    {
      name: '移動平均フィルタ',
      filters: [
        { value: 'moving_average_3', label: '3点移動平均' },
        { value: 'moving_average_5', label: '5点移動平均' },
        { value: 'moving_average_7', label: '7点移動平均' },
        { value: 'moving_average_9', label: '9点移動平均' },
      ]
    },
    {
      name: '加重移動平均フィルタ',
      filters: [
        { value: 'weighted_moving_average', label: '加重移動平均' },
        { value: 'gaussian', label: 'ガウシアンフィルタ' },
      ]
    },
    {
      name: 'メディアンフィルタ',
      filters: [
        { value: 'median_3', label: '3点メディアン' },
        { value: 'median_5', label: '5点メディアン' },
      ]
    },
    {
      name: 'FFTベースフィルタ',
      filters: [
        { value: 'fft_lowpass', label: 'FFTローパス' },
        { value: 'fft_highpass', label: 'FFTハイパス' },
        { value: 'fft_bandpass', label: 'FFTバンドパス' },
      ]
    },
    {
      name: '高度なフィルタ',
      filters: [
        { value: 'savitzky_golay', label: 'Savitzky-Golay' },
        { value: 'exponential', label: '指数平滑化' },
      ]
    }
  ]

  return (
    <div className="filter-options">
      <label className="filter-label">フィルタ選択:</label>
      <div className="filter-grid">
        {filterCategories.map((category) => (
          <div key={category.name} className="filter-category">
            <h4>{category.name}</h4>
            <div className="filter-buttons">
              {category.filters.map((filter) => (
                <button
                  key={filter.value}
                  className={`filter-btn ${filterType === filter.value ? 'active' : ''}`}
                  onClick={() => onFilterChange(filter.value)}
                  disabled={disabled}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default FilterOptions
