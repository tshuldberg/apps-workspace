# UNVERIFIED - pending signed dev build (Plan 25 WP-25F).
#
# The Swift source is a real authored PushKit and CallKit implementation, but it
# has not been compiled or physical-device proven in this environment. This pod
# is consumed only through the local workspace and Expo autolinking.

require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'MeerkatCallNative'
  s.version        = package['version']
  s.summary        = package['description']
  s.license        = 'UNLICENSED'
  s.author         = 'MyLife'
  s.homepage       = 'https://github.com/mylife/meerkat'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'CallKit', 'PushKit', 'AVFoundation'

  s.swift_version  = '5.9'
  s.source_files   = '*.{swift,h,m}'
end
