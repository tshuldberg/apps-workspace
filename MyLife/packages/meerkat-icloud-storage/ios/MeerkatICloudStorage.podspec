# UNVERIFIED until a signed dev build and physical-device matrix compile and exercise this module.

require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name             = 'MeerkatICloudStorage'
  s.version          = package['version']
  s.summary          = package['description']
  s.license          = 'UNLICENSED'
  s.author           = 'MyLife'
  s.homepage         = 'https://github.com/mylife/meerkat'
  s.platforms        = { :ios => '15.1' }
  s.source           = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks       = 'Foundation'
  s.swift_version    = '5.9'
  s.source_files     = '*.{swift,h,m}'
end
