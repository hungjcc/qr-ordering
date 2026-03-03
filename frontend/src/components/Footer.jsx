import { MapPin, Phone, Clock } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 dark:bg-gray-800 text-gray-300 dark:text-gray-300 py-8 mt-auto border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Restaurant Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Address */}
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary-500 mt-1" />
            <div>
              <h3 className="font-semibold text-white dark:text-white mb-1">地址</h3>
              <p className="text-sm text-gray-300 dark:text-gray-300">
                Shop No. 2,3,4, Angan Apt, Radha Nagar,<br />
                Tulinj Road, Near Amantaran Bar,<br />
                Nallasopara East, Palghar - 401209
              </p>
            </div>
          </div>
          
          {/* Phone */}
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-primary-500 mt-1" />
            <div>
              <h3 className="font-semibold text-white dark:text-white mb-1">聯絡方式</h3>
              <p className="text-sm text-gray-300 dark:text-gray-300">
                <a href="tel:917030802567" className="hover:text-primary-400 transition-colors text-gray-300 dark:text-gray-300">
                  +91 7030802567
                </a>
                <br />
                <a href="tel:917798757769" className="hover:text-primary-400 transition-colors text-gray-300 dark:text-gray-300">
                  +91 7798757769
                </a>
              </p>
            </div>
          </div>
          
          {/* Timing */}
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-primary-500 mt-1" />
            <div>
              <h3 className="font-semibold text-white dark:text-white mb-1">營業時間</h3>
              <p className="text-sm text-gray-300 dark:text-gray-300">
                每日營業<br />
                11:30 AM - 11:30 PM
              </p>
            </div>
          </div>
        </div>
        
        {/* Map */}
        <div className="mb-6">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3765.123456789!2d72.8246998!3d19.4261277!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTnCsDI1JzM5LjYiTiA3MsKwNDknMzguNCJF!5e0!3m2!1sen!2sin!4v1600000000000!5m2!1sen!2sin"
            width="100%"
            height="200"
            style={{ border: 0, borderRadius: '8px' }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="熊熊冰室位置"
            className="grayscale opacity-70 hover:grayscale-0 transition-all duration-300"
          />
        </div>
        
        {/* Copyright */}
        <div className="border-t border-gray-800 dark:border-gray-700 pt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} 熊熊冰室。版權所有。
          </p>
        </div>
      </div>
    </footer>
  )
}
