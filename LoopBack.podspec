Pod::Spec.new do |s|
  s.name     = 'LoopBack'
  s.version  = '1.2.1'
  s.license  = { :type => 'MIT & StrongLoop', :file => 'LICENSE' }
  s.summary  = 'iOS Client SDK for the LoopBack framework.'
  s.homepage = 'https://github.com/strongloop/loopback-ios'
  s.authors  = { }
  s.source   = { :git => 'https://github.com/strongloop/loopback-ios.git', :tag => '1.2.1' }
  s.source_files = 'LoopBack'
  s.requires_arc = true

  s.dependency 'SLRemoting', '~> 1.0.1'
  
  s.ios.deployment_target = '6.1'
  s.ios.frameworks = 'MobileCoreServices', 'SystemConfiguration', 'Fonudation', 'SenTestingKit', 'UIKit'
end
